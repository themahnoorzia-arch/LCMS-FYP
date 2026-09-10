import datetime
from decimal import Decimal

import psycopg2.extras

from flask import jsonify, request
from flask_login import login_required, current_user

from blueprints.financials import financials_bp
from db.db import get_pg_connection


# ==========================================================
# GET PAYMENTS
# ==========================================================
@financials_bp.route("/api/payments", methods=["GET"])
@login_required
def get_payments():
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if current_user.role == "Lawyer":
            cur.execute(
                """
                SELECT p.paymentid, p.paymentdate, p.purpose, p.balance,
                       p.mode, p.paymenttype, p.status,
                       c.title AS casename, ct.courtname,
                       TRIM(lu.firstname || ' ' || lu.lastname) AS lawyername,
                       (SELECT TRIM(cu.firstname || ' ' || cu.lastname)
                        FROM caseparticipantaccess cpa
                        JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                        JOIN users cu ON cu.userid = cp.userid
                        WHERE cpa.caseid = c.caseid LIMIT 1) AS clientname
                FROM payments p
                JOIN lawyer l ON l.lawyerid = p.lawyerid
                JOIN users lu ON lu.userid = l.userid
                JOIN cases c ON c.caseid = p.caseid
                LEFT JOIN court ct ON ct.courtid = p.courtid
                WHERE l.userid = %s
                ORDER BY p.paymentdate DESC NULLS LAST
                """,
                (current_user.userid,),
            )

        elif current_user.role == "CourtRegistrar":
            cur.execute(
                """
                SELECT p.paymentid, p.paymentdate, p.purpose, p.balance,
                       p.mode, p.paymenttype, p.status,
                       c.title AS casename, ct.courtname,
                       TRIM(lu.firstname || ' ' || lu.lastname) AS lawyername,
                       (SELECT TRIM(cu.firstname || ' ' || cu.lastname)
                        FROM caseparticipantaccess cpa
                        JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                        JOIN users cu ON cu.userid = cp.userid
                        WHERE cpa.caseid = c.caseid LIMIT 1) AS clientname
                FROM payments p
                JOIN cases c ON c.caseid = p.caseid
                JOIN court ct ON ct.courtid = p.courtid
                JOIN courtregistrar cr ON cr.courtid = ct.courtid
                LEFT JOIN lawyer l ON l.lawyerid = p.lawyerid
                LEFT JOIN users lu ON lu.userid = l.userid
                WHERE cr.userid = %s
                ORDER BY p.paymentdate DESC NULLS LAST
                """,
                (current_user.userid,),
            )

        else:
            return jsonify({"status": "error", "message": "Unauthorized role"}), 403

        rows = cur.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            if row.get("paymentdate"):
                row["paymentdate"] = row["paymentdate"].isoformat()
            if row.get("balance") is not None:
                row["balance"] = float(row["balance"])
            result.append(row)

        return jsonify({"status": "success", "payments": result}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# CREATE PAYMENT REQUEST (Registrar only)
# ==========================================================
@financials_bp.route("/api/payments", methods=["POST"])
@login_required
def create_payment():
    if current_user.role != "CourtRegistrar":
        return jsonify({"message": "Only court registrars can create payment requests"}), 403

    data = request.get_json() or {}
    case_id = data.get("caseid")
    purpose = data.get("purpose", "").strip()
    balance = data.get("balance")
    payment_type = data.get("paymenttype", "Court Fee").strip()
    requested_lawyer_id = data.get("lawyerid")

    if not case_id or not purpose or balance is None:
        return jsonify({"message": "caseid, purpose, and balance are required"}), 400

    try:
        if float(balance) <= 0:
            return jsonify({"message": "Balance must be greater than zero"}), 400
    except (TypeError, ValueError):
        return jsonify({"message": "Balance must be a valid number"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Get registrar's court
        cur.execute(
            "SELECT courtid FROM courtregistrar WHERE userid = %s",
            (current_user.userid,),
        )
        reg = cur.fetchone()
        if not reg:
            return jsonify({"message": "Registrar profile not found"}), 404
        court_id = reg["courtid"]

        cur.execute(
            "SELECT 1 FROM courtaccess WHERE caseid = %s AND courtid = %s",
            (case_id, court_id),
        )
        if not cur.fetchone():
            return jsonify({"message": "Case is not assigned to your court"}), 403

        # Which lawyer this payment is owed by/directed to — a case with
        # counsel on both sides can have either side pay, so the registrar
        # picks explicitly. Whichever lawyer is named must actually be
        # approved on this exact case (not just approved on some other case).
        if requested_lawyer_id:
            cur.execute(
                """
                SELECT l.lawyerid FROM caselawyeraccess cla
                JOIN lawyer l ON l.lawyerid = cla.lawyerid
                WHERE cla.caseid = %s AND l.lawyerid = %s AND LOWER(cla.status) = 'approved'
                """,
                (case_id, requested_lawyer_id),
            )
            lawyer_row = cur.fetchone()
            if not lawyer_row:
                return jsonify({"message": "That lawyer is not approved on this case"}), 400
            lawyer_id = lawyer_row["lawyerid"]
        else:
            # No lawyer specified — fall back to the lead lawyer (or the
            # only lawyer, on a single-sided case).
            cur.execute(
                """
                SELECT l.lawyerid FROM caselawyeraccess cla
                JOIN lawyer l ON l.lawyerid = cla.lawyerid
                WHERE cla.caseid = %s AND LOWER(cla.status) = 'approved'
                ORDER BY cla.is_lead DESC NULLS LAST
                LIMIT 1
                """,
                (case_id,),
            )
            lawyer_row = cur.fetchone()
            lawyer_id = lawyer_row["lawyerid"] if lawyer_row else None

        # Idempotency guard against double-click / double-submit: if this
        # exact still-pending request (same case, lawyer, purpose, amount,
        # type) already exists, hand back that one instead of inserting a
        # second one. Once it's confirmed or verified its status moves off
        # 'Pending', so a genuine second request for the same thing later
        # is never blocked by this.
        cur.execute(
            """
            SELECT paymentid FROM payments
            WHERE caseid = %s AND lawyerid IS NOT DISTINCT FROM %s
              AND purpose = %s AND balance = %s AND paymenttype = %s
              AND status = 'Pending'
            ORDER BY paymentid DESC LIMIT 1
            """,
            (case_id, lawyer_id, purpose, Decimal(str(balance)), payment_type),
        )
        dup = cur.fetchone()
        if dup:
            return jsonify({"message": "Payment request created", "paymentid": dup["paymentid"]}), 201

        # This database schema does not generate payment IDs automatically.
        # Lock the table while allocating the next ID to avoid duplicate IDs.
        cur.execute("LOCK TABLE payments IN EXCLUSIVE MODE")
        cur.execute("SELECT COALESCE(MAX(paymentid), 0) + 1 AS next_id FROM payments")
        payment_id = cur.fetchone()["next_id"]

        cur.execute(
            """
            INSERT INTO payments
                (paymentid, purpose, balance, mode, paymenttype, caseid, courtid, lawyerid, status)
            VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, 'Pending')
            RETURNING paymentid
            """,
            (
                payment_id,
                purpose,
                Decimal(str(balance)),
                payment_type,
                case_id,
                court_id,
                lawyer_id,
            ),
        )
        new_id = cur.fetchone()["paymentid"]
        conn.commit()

        # Notify the lawyer
        try:
            from utils.notifications import push_notification
            if lawyer_id:
                cur.execute("SELECT userid FROM lawyer WHERE lawyerid = %s", (lawyer_id,))
                lr = cur.fetchone()
                if lr:
                    push_notification(lr["userid"], "New Payment Request",
                        f"A payment request of PKR {balance} has been sent to you for a case. Please confirm payment.",
                        "warning", new_id)
        except Exception:
            pass

        return jsonify({"message": "Payment request created", "paymentid": new_id}), 201

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# CONFIRM PAYMENT (Lawyer only)
# ==========================================================
@financials_bp.route("/api/payments/<int:payment_id>/confirm", methods=["PATCH"])
@login_required
def confirm_payment(payment_id):
    if current_user.role != "Lawyer":
        return jsonify({"message": "Only lawyers can confirm payments"}), 403

    data = request.get_json() or {}
    mode = data.get("mode", "").strip()
    payment_date = data.get("paymentdate") or datetime.date.today().isoformat()

    valid_modes = ["Cash", "Credit/Debit card", "Online Transfer"]
    if mode not in valid_modes:
        return jsonify({"message": f"Mode must be one of: {', '.join(valid_modes)}"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verify the payment belongs to this lawyer
        cur.execute(
            """
            SELECT p.paymentid FROM payments p
            JOIN lawyer l ON l.lawyerid = p.lawyerid
            WHERE p.paymentid = %s AND l.userid = %s AND p.status = 'Pending'
            """,
            (payment_id, current_user.userid),
        )
        if not cur.fetchone():
            return jsonify({"message": "Payment not found or already confirmed"}), 404

        cur.execute(
            """
            UPDATE payments
            SET mode = %s, paymentdate = %s, status = 'Pending Verification'
            WHERE paymentid = %s
            """,
            (mode, payment_date, payment_id),
        )
        conn.commit()

        # Notify the registrar who created this payment — it's a claim,
        # not a verified payment yet, so ask them to review it.
        try:
            from utils.notifications import push_notification
            cur.execute(
                """SELECT cr.userid FROM courtregistrar cr
                   JOIN payments p ON p.courtid = cr.courtid
                   WHERE p.paymentid = %s""",
                (payment_id,),
            )
            reg = cur.fetchone()
            if reg:
                push_notification(reg["userid"], "Payment Awaiting Verification",
                    f"A lawyer reported payment #{payment_id} as paid. Please verify it.", "warning", payment_id)
        except Exception:
            pass

        return jsonify({"message": "Payment reported. Awaiting registrar verification."}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# VERIFY PAYMENT (CourtRegistrar only)
# ==========================================================
@financials_bp.route("/api/payments/<int:payment_id>/verify", methods=["PATCH"])
@login_required
def verify_payment(payment_id):
    if current_user.role != "CourtRegistrar":
        return jsonify({"message": "Only court registrars can verify payments"}), 403

    data = request.get_json() or {}
    approve = data.get("approve", True)

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Must be this registrar's own court, and the payment must actually
        # be sitting in the "lawyer claims paid" state.
        cur.execute(
            """
            SELECT p.paymentid, p.lawyerid FROM payments p
            JOIN courtregistrar cr ON cr.courtid = p.courtid
            WHERE p.paymentid = %s AND cr.userid = %s AND p.status = 'Pending Verification'
            """,
            (payment_id, current_user.userid),
        )
        payment = cur.fetchone()
        if not payment:
            return jsonify({"message": "Payment not found or not awaiting verification"}), 404

        new_status = "Paid" if approve else "Pending"
        cur.execute(
            "UPDATE payments SET status = %s WHERE paymentid = %s",
            (new_status, payment_id),
        )
        conn.commit()

        try:
            from utils.notifications import push_notification
            if payment["lawyerid"]:
                cur.execute("SELECT userid FROM lawyer WHERE lawyerid = %s", (payment["lawyerid"],))
                lr = cur.fetchone()
                if lr:
                    msg = (
                        f"Your payment #{payment_id} has been verified as Paid."
                        if approve else
                        f"Your payment #{payment_id} confirmation was rejected by the registrar. Please re-confirm with correct details."
                    )
                    push_notification(lr["userid"], "Payment Verification Update", msg,
                        "success" if approve else "warning", payment_id)
        except Exception:
            pass

        return jsonify({"message": f"Payment marked {new_status}"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()
