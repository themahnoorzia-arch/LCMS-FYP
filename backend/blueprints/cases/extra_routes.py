"""Routes migrated from the legacy monolithic app (hearings write and decisions)."""
import datetime

from flask import jsonify, request
from flask_login import login_required, current_user

import psycopg2.extras

from blueprints.cases import cases_bp
from blueprints.cases.case_routes import build_case_timeline_events
from db.db import get_pg_connection


@cases_bp.route("/cases/history", methods=["GET"])
@login_required
def get_all_case_history():
    """
    Return the full derived+manual event timeline (case filed, judge
    assigned, evidence/witnesses added, hearings, final decision, plus any
    manual notes) across every case in the registrar's court, newest first.
    Used by the Case History page in the registrar dashboard. Reuses the
    same event-building logic as the per-case history endpoint so the two
    views never drift apart.
    """
    if current_user.role not in ('CourtRegistrar', 'Admin'):
        return jsonify({"error": "Court registrar access required"}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

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

        if court_id is not None:
            cur.execute("SELECT caseid FROM courtaccess WHERE courtid = %s", (court_id,))
        else:
            cur.execute("SELECT caseid FROM cases")
        case_ids = [r['caseid'] for r in cur.fetchall()]

        all_events = []
        for case_id in case_ids:
            events = build_case_timeline_events(cur, case_id)
            if events:
                all_events.extend(events)

        all_events.sort(key=lambda e: e["actionDate"] or "0000-00-00", reverse=True)

        return jsonify({"history": all_events}), 200

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


