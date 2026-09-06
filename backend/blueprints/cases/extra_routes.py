"""Routes migrated from the legacy monolithic app (hearings write and decisions)."""
import datetime

from flask import jsonify, request
from flask_login import login_required, current_user

import psycopg2.extras

from blueprints.cases import cases_bp
from db.db import SessionLocal, get_pg_connection

from models import (
    Cases,
    Casehistory,
    Finaldecision,
    Judge,
    Lawyer,
    Users,
)


@cases_bp.route("/cases/history", methods=["GET"])
@login_required
def get_all_case_history():
    """
    Return all case history entries enriched with case metadata.
    Used by the Manage Case History page in the registrar dashboard.
    Each row includes case name, case number, judge, client, lawyer, status.
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if current_user.role not in ('CourtRegistrar', 'Admin'):
            return jsonify({"error": "Court registrar access required"}), 403

        court_id = None
        if current_user.role == 'CourtRegistrar':
            cur.execute(
                "SELECT courtid FROM courtregistrar WHERE userid = %s",
                (current_user.userid,),
            )
            registrar = cur.fetchone()
            if not registrar or not registrar['courtid']:
                return jsonify({"history": []}), 200
            court_id = registrar['courtid']

        cur.execute(
            """
            SELECT
                ch.historyid,
                ch.actiondate,
                ch.actiontaken,
                ch.remarks,
                c.caseid,
                c.title      AS casename,
                c.casenumber,
                c.status,
                (
                    SELECT TRIM(u.firstname || ' ' || u.lastname)
                    FROM judgeaccess ja
                    JOIN judge j ON j.judgeid = ja.judgeid
                    JOIN users u ON u.userid  = j.userid
                    WHERE ja.caseid = c.caseid LIMIT 1
                ) AS judgename,
                (
                    SELECT TRIM(u.firstname || ' ' || u.lastname)
                    FROM caseparticipantaccess cpa
                    JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                    JOIN users u            ON u.userid         = cp.userid
                    WHERE cpa.caseid = c.caseid LIMIT 1
                ) AS clientname,
                (
                    SELECT TRIM(u.firstname || ' ' || u.lastname)
                    FROM caselawyeraccess cla
                    JOIN lawyer lw ON lw.lawyerid = cla.lawyerid
                    JOIN users u   ON u.userid    = lw.userid
                    WHERE cla.caseid = c.caseid LIMIT 1
                ) AS lawyername
            FROM casehistory ch
            JOIN cases c ON c.caseid = ch.caseid
            WHERE (%s IS NULL OR EXISTS (
                SELECT 1 FROM courtaccess ca
                WHERE ca.caseid = c.caseid AND ca.courtid = %s
            ))
            ORDER BY ch.actiondate DESC NULLS LAST, ch.historyid DESC
            """,
            (court_id, court_id),
        )

        rows = cur.fetchall()
        result = [
            {
                "historyid":   r["historyid"],
                "caseid":      r["caseid"],
                "caseName":    r["casename"],
                "casenumber":  r["casenumber"] or "—",
                "judgeName":   r["judgename"]  or "—",
                "clientName":  r["clientname"] or "—",
                "lawyerName":  r["lawyername"] or "—",
                "actionDate":  r["actiondate"].isoformat() if r["actiondate"] else None,
                "actionTaken": r["actiontaken"],
                "remarks":     r["remarks"] or "",
                "status":      r["status"],
                "eventType":   "manual",
            }
            for r in rows
        ]

        return jsonify({"history": result}), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/cases/<int:case_id>/final-decision", methods=["POST"])
@login_required
def add_final_decision(case_id):
    if (current_user.role or "") != "Judge":
        return jsonify({"message": "Only judges can submit a final decision"}), 403

    conn = None
    try:
        data = request.get_json() or {}
        decision_summary = data.get("decisionsummary")
        verdict = data.get("verdict")
        decision_date = data.get("decisiondate") or datetime.date.today().isoformat()

        if not decision_summary or not verdict:
            return jsonify({
                "message": "Decision summary and verdict are required",
            }), 400

        conn = get_pg_connection()
        cur = conn.cursor()

        cur.execute(
            """SELECT c.status FROM cases c
               JOIN judgeaccess ja ON ja.caseid = c.caseid
               JOIN judge j ON j.judgeid = ja.judgeid
               WHERE c.caseid = %s AND j.userid = %s""",
            (case_id, current_user.userid),
        )
        case_row = cur.fetchone()
        if not case_row:
            return jsonify({"message": "Case not found or not assigned to you"}), 404
        if case_row[0] == "Closed":
            return jsonify({"message": "This case is already closed"}), 409

        cur.execute(
            """
            INSERT INTO finaldecision (caseid, decisionsummary, verdict, decisiondate)
            VALUES (%s, %s, %s, %s)
            RETURNING decisionid
            """,
            (case_id, decision_summary, verdict, decision_date),
        )
        decision_id = cur.fetchone()[0]

        cur.execute(
            "UPDATE cases SET status = 'Closed' WHERE caseid = %s",
            (case_id,),
        )
        cur.execute(
            """
            INSERT INTO casehistory (caseid, actiondate, actiontaken, remarks)
            VALUES (%s, %s, %s, %s)
            """,
            (
                case_id,
                decision_date,
                f"Case closed with verdict: {verdict}",
                decision_summary,
            ),
        )
        conn.commit()

        # Notify lawyers and clients
        try:
            from utils.notifications import push_notification
            nc = conn.cursor()
            nc.execute(
                "SELECT l.userid FROM lawyer l JOIN caselawyeraccess cla ON cla.lawyerid = l.lawyerid "
                "WHERE cla.caseid = %s AND LOWER(cla.status) = 'approved'",
                (case_id,),
            )
            for row in nc.fetchall():
                push_notification(row[0], "Case Decision Recorded",
                    f"A final verdict '{verdict}' has been recorded for case #{case_id}.", "success", case_id)
            nc.execute(
                "SELECT cp.userid FROM caseparticipant cp JOIN caseparticipantaccess cpa ON cpa.participantid = cp.participantid WHERE cpa.caseid = %s",
                (case_id,),
            )
            for row in nc.fetchall():
                push_notification(row[0], "Case Decision Recorded",
                    f"A final verdict has been recorded for your case. Verdict: {verdict}.", "success", case_id)
        except Exception:
            pass

        return jsonify({
            "message": "Final decision added successfully",
            "decision_id": decision_id,
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


