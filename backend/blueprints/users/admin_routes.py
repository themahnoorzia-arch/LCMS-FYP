"""Admin-only API routes."""
import psycopg2.extras
from flask import jsonify, request
from flask_login import login_required, current_user

from blueprints.users import users_bp
from db.db import get_pg_connection


def _require_admin():
    if current_user.role != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


# ── Stats overview ──────────────────────────────────────────────────────────

@users_bp.route("/api/admin/stats", methods=["GET"])
@login_required
def admin_stats():
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT COUNT(*) AS total FROM cases")
        total_cases = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM cases WHERE status = 'Open'")
        open_cases = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM cases WHERE status = 'Pending'")
        pending_cases = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM cases WHERE status = 'Closed'")
        closed_cases = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM users")
        total_users = cur.fetchone()["total"]

        cur.execute("SELECT role, COUNT(*) AS cnt FROM users GROUP BY role ORDER BY role")
        users_by_role = {r["role"]: r["cnt"] for r in cur.fetchall()}

        cur.execute("SELECT COUNT(*) AS total FROM hearings")
        total_hearings = cur.fetchone()["total"]

        return jsonify({
            "cases": {
                "total": total_cases,
                "open": open_cases,
                "pending": pending_cases,
                "closed": closed_cases,
            },
            "users": {
                "total": total_users,
                "by_role": users_by_role,
            },
            "hearings": {"total": total_hearings},
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ── User management ─────────────────────────────────────────────────────────

@users_bp.route("/api/admin/users", methods=["GET"])
@login_required
def admin_list_users():
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                u.userid, u.firstname, u.lastname, u.email,
                u.phoneno, u.cnic, u.role, u.createdat,
                CASE
                    WHEN u.role = 'Judge' THEN
                        (SELECT j.specialization FROM judge j WHERE j.userid = u.userid LIMIT 1)
                    WHEN u.role = 'Lawyer' THEN
                        (SELECT l.specialization FROM lawyer l WHERE l.userid = u.userid LIMIT 1)
                    ELSE NULL
                END AS specialization
            FROM users u
            ORDER BY u.createdat DESC NULLS LAST, u.userid DESC
            """
        )
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userid":         r["userid"],
                "name":           f"{r['firstname'] or ''} {r['lastname'] or ''}".strip(),
                "firstname":      r["firstname"],
                "lastname":       r["lastname"],
                "email":          r["email"] or "—",
                "phone":          r["phoneno"] or "—",
                "cnic":           r["cnic"] or "—",
                "role":           r["role"],
                "specialization": r["specialization"] or "—",
                "joinedAt":       r["createdat"].isoformat() if r["createdat"] else None,
            })
        return jsonify({"users": result}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@login_required
def admin_delete_user(user_id):
    err = _require_admin()
    if err:
        return err
    if user_id == current_user.userid:
        return jsonify({"error": "Cannot delete your own account"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT firstname, lastname, role FROM users WHERE userid = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404
        cur.execute("DELETE FROM users WHERE userid = %s", (user_id,))
        conn.commit()

        from utils.logging import write_log
        write_log(
            "DELETE",
            f"Admin deleted user: {user['firstname']} {user['lastname']} ({user['role']})",
            "user",
        )
        return jsonify({"message": "User deleted"}), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/pending-approvals", methods=["GET"])
@login_required
def admin_list_pending_approvals():
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT userid, firstname, lastname, email, phoneno, cnic, role, createdat
            FROM users
            WHERE approval_status = 'pending' AND role IN ('Judge', 'CourtRegistrar')
            ORDER BY createdat ASC NULLS LAST, userid ASC
            """
        )
        rows = cur.fetchall()
        result = [{
            "userid": r["userid"],
            "name": f"{r['firstname'] or ''} {r['lastname'] or ''}".strip(),
            "email": r["email"],
            "phone": r["phoneno"],
            "cnic": r["cnic"],
            "role": r["role"],
            "requestedAt": r["createdat"].isoformat() if r["createdat"] else None,
        } for r in rows]
        return jsonify({"pending": result}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/courts", methods=["GET"])
@login_required
def admin_list_courts():
    """Full court list for the Manage Courts page — every court, plus
    whichever registrar (if any) currently runs it."""
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT c.courtid, c.courtname, c.type, c.location,
                   TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) AS registrarname
            FROM court c
            LEFT JOIN courtregistrar cr ON cr.courtid = c.courtid
            LEFT JOIN users u ON u.userid = cr.userid
            ORDER BY c.courtname
            """
        )
        rows = cur.fetchall()
        result = [{
            "id": r["courtid"],
            "courtname": r["courtname"],
            "type": r["type"],
            "location": r["location"],
            "registrarName": r["registrarname"] or None,
        } for r in rows]
        return jsonify({"courts": result}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/courts/<int:court_id>", methods=["DELETE"])
@login_required
def admin_delete_court(court_id):
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT 1 FROM courtregistrar WHERE courtid = %s", (court_id,))
        if cur.fetchone():
            return jsonify({"error": "This court has a registrar assigned — unassign it first."}), 409

        cur.execute("DELETE FROM court WHERE courtid = %s RETURNING courtname", (court_id,))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"error": "Court not found"}), 404
        conn.commit()

        from utils.logging import write_log
        write_log("DELETE", f"Admin deleted court: {deleted['courtname']}", "court")
        return jsonify({"message": "Court deleted"}), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/unclaimed-courts", methods=["GET"])
@login_required
def admin_list_unclaimed_courts():
    """Courts with no registrar assigned yet — for the court-assignment
    step of approving a CourtRegistrar applicant. One court, one registrar:
    a court already claimed by a registrar never shows up here."""
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT c.courtid, c.courtname, c.type, c.location
            FROM court c
            WHERE NOT EXISTS (
                SELECT 1 FROM courtregistrar cr WHERE cr.courtid = c.courtid
            )
            ORDER BY c.courtname
            """
        )
        rows = cur.fetchall()
        result = [{
            "id": r["courtid"],
            "courtname": r["courtname"],
            "type": r["type"],
            "location": r["location"],
        } for r in rows]
        return jsonify({"courts": result}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/users/<int:user_id>/approve", methods=["POST"])
@login_required
def admin_approve_user(user_id):
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            "SELECT userid, firstname, lastname, role FROM users "
            "WHERE userid = %s AND approval_status = 'pending' "
            "AND role IN ('Judge', 'CourtRegistrar')",
            (user_id,),
        )
        applicant = cur.fetchone()
        if not applicant:
            return jsonify({"error": "Pending account not found"}), 404

        # A CourtRegistrar can't be approved without also being assigned to
        # a court — courts are managed separately (Manage Courts), never
        # created here. Courts aren't relevant for Judge approvals, so this
        # whole block is skipped for them.
        if applicant["role"] == "CourtRegistrar":
            court_id = data.get("courtid")

            if not court_id:
                return jsonify({
                    "error": "Assign this registrar to an existing unclaimed court."
                }), 400

            cur.execute(
                """
                SELECT c.courtid FROM court c
                WHERE c.courtid = %s
                  AND NOT EXISTS (SELECT 1 FROM courtregistrar cr WHERE cr.courtid = c.courtid)
                """,
                (court_id,),
            )
            if not cur.fetchone():
                return jsonify({"error": "That court doesn't exist or already has a registrar assigned."}), 409

            cur.execute(
                "UPDATE courtregistrar SET courtid = %s WHERE userid = %s",
                (court_id, user_id),
            )

        cur.execute(
            "UPDATE users SET approval_status = 'approved' WHERE userid = %s",
            (user_id,),
        )
        conn.commit()

        from utils.logging import write_log
        write_log(
            "UPDATE",
            f"Admin approved {applicant['role']} account: {applicant['firstname']} {applicant['lastname']}",
            "user",
        )
        try:
            from utils.notifications import push_notification
            push_notification(
                user_id, "Account Approved",
                "Your account has been approved by an administrator. You can now log in.",
                "success", None,
            )
        except Exception:
            pass

        return jsonify({"message": "User approved"}), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/users/<int:user_id>/reject", methods=["POST"])
@login_required
def admin_reject_user(user_id):
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "UPDATE users SET approval_status = 'rejected' "
            "WHERE userid = %s AND role IN ('Judge', 'CourtRegistrar') "
            "RETURNING firstname, lastname, role",
            (user_id,),
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "Pending account not found"}), 404
        conn.commit()

        from utils.logging import write_log
        write_log(
            "UPDATE",
            f"Admin rejected {updated['role']} account: {updated['firstname']} {updated['lastname']}",
            "user",
        )
        return jsonify({"message": "User rejected"}), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@users_bp.route("/api/admin/users/<int:user_id>/role", methods=["PATCH"])
@login_required
def admin_change_role(user_id):
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    new_role = data.get("role", "").strip()
    valid_roles = ["Admin", "CourtRegistrar", "CaseParticipant", "Lawyer", "Judge"]
    if new_role not in valid_roles:
        return jsonify({"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "UPDATE users SET role = %s WHERE userid = %s RETURNING firstname, lastname",
            (new_role, user_id),
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "User not found"}), 404
        conn.commit()

        from utils.logging import write_log
        write_log(
            "UPDATE",
            f"Admin changed role of {updated['firstname']} {updated['lastname']} to {new_role}",
            "user",
        )
        return jsonify({"message": "Role updated"}), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ── All cases overview ───────────────────────────────────────────────────────

@users_bp.route("/api/admin/cases", methods=["GET"])
@login_required
def admin_list_cases():
    err = _require_admin()
    if err:
        return err
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                c.caseid, c.title, c.casenumber, c.casetype,
                c.status, c.filingdate,
                (SELECT ct.courtname FROM courtaccess ca JOIN court ct ON ct.courtid = ca.courtid
                 WHERE ca.caseid = c.caseid LIMIT 1) AS courtname,
                (SELECT TRIM(u.firstname||' '||u.lastname) FROM judgeaccess ja
                 JOIN judge j ON j.judgeid = ja.judgeid JOIN users u ON u.userid = j.userid
                 WHERE ja.caseid = c.caseid LIMIT 1) AS judgename,
                (SELECT TRIM(u.firstname||' '||u.lastname) FROM caselawyeraccess cla
                 JOIN lawyer lw ON lw.lawyerid = cla.lawyerid JOIN users u ON u.userid = lw.userid
                 WHERE cla.caseid = c.caseid LIMIT 1) AS lawyername,
                (SELECT TRIM(u.firstname||' '||u.lastname) FROM caseparticipantaccess cpa
                 JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                 JOIN users u ON u.userid = cp.userid
                 WHERE cpa.caseid = c.caseid LIMIT 1) AS clientname
            FROM cases c
            ORDER BY c.filingdate DESC NULLS LAST, c.caseid DESC
            """
        )
        rows = cur.fetchall()
        result = [{
            "caseid":     r["caseid"],
            "title":      r["title"],
            "casenumber": r["casenumber"] or "—",
            "casetype":   r["casetype"] or "—",
            "status":     r["status"],
            "filingdate": r["filingdate"].isoformat() if r["filingdate"] else None,
            "court":      r["courtname"] or "—",
            "judge":      r["judgename"] or "—",
            "lawyer":     r["lawyername"] or "—",
            "client":     r["clientname"] or "—",
        } for r in rows]
        return jsonify({"cases": result}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()
