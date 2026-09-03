from flask import jsonify, request
from flask_login import login_required, current_user

import psycopg2
import psycopg2.extras

from blueprints.cases import cases_bp
from db.db import get_pg_connection


@cases_bp.route("/hearings", methods=["GET"])
@login_required
def get_hearings():
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        role = current_user.role
        userid = current_user.userid

        if role == "Judge":
            cur.execute(
                """
                SELECT h.hearingid, h.hearingdate, h.hearingtime, h.venue,
                       h.remarks, h.hearingstatus, c.caseid, c.title AS casename,
                       ct.courtname
                FROM hearings h
                JOIN cases c ON h.caseid = c.caseid
                JOIN judge j ON h.judgeid = j.judgeid
                LEFT JOIN courtaccess ca ON ca.caseid = c.caseid
                LEFT JOIN court ct ON ct.courtid = ca.courtid
                WHERE j.userid = %s
                ORDER BY h.hearingdate DESC
                """,
                (userid,),
            )
        elif role == "Lawyer":
            cur.execute(
                """
                SELECT h.hearingid, h.hearingdate, h.hearingtime, h.venue,
                       h.remarks, h.hearingstatus, c.caseid, c.title AS casename,
                       ct.courtname
                FROM hearings h
                JOIN cases c ON h.caseid = c.caseid
                JOIN caselawyeraccess cla ON cla.caseid = c.caseid
                JOIN lawyer l ON l.lawyerid = cla.lawyerid
                LEFT JOIN courtaccess ca ON ca.caseid = c.caseid
                LEFT JOIN court ct ON ct.courtid = ca.courtid
                WHERE l.userid = %s
                ORDER BY h.hearingdate DESC
                """,
                (userid,),
            )
        elif role == "CaseParticipant":
            cur.execute(
                """
                SELECT h.hearingid, h.hearingdate, h.hearingtime, h.venue,
                       h.remarks, h.hearingstatus, c.caseid, c.title AS casename,
                       ct.courtname
                FROM hearings h
                JOIN cases c ON h.caseid = c.caseid
                JOIN caseparticipantaccess cpa ON cpa.caseid = c.caseid
                JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                LEFT JOIN courtaccess ca ON ca.caseid = c.caseid
                LEFT JOIN court ct ON ct.courtid = ca.courtid
                WHERE cp.userid = %s
                ORDER BY h.hearingdate DESC
                """,
                (userid,),
            )
        else:
            cur.execute(
                """
                SELECT h.hearingid, h.hearingdate, h.hearingtime, h.venue,
                       h.remarks, h.hearingstatus, c.caseid, c.title AS casename,
                       ct.courtname
                FROM hearings h
                JOIN cases c ON h.caseid = c.caseid
                LEFT JOIN courtaccess ca ON ca.caseid = c.caseid
                LEFT JOIN court ct ON ct.courtid = ca.courtid
                ORDER BY h.hearingdate DESC
                """
            )

        rows = cur.fetchall()
        result = []
        for hearing in rows:
            caseid = hearing.get("caseid")
            cur.execute(
                """SELECT
                       TRIM(COALESCE(ju.firstname, '') || ' ' || COALESCE(ju.lastname, '')) AS judgename,
                       (SELECT STRING_AGG(DISTINCT TRIM(COALESCE(lu.firstname, '') || ' ' || COALESCE(lu.lastname, '')), ' & ')
                        FROM caselawyeraccess cla
                        JOIN lawyer lw ON lw.lawyerid = cla.lawyerid
                        JOIN users lu ON lu.userid = lw.userid
                        WHERE cla.caseid = %s) AS lawyernames,
                       (SELECT TRIM(COALESCE(cu.firstname, '') || ' ' || COALESCE(cu.lastname, ''))
                        FROM caseparticipantaccess cpa
                        JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                        JOIN users cu ON cu.userid = cp.userid
                        WHERE cpa.caseid = %s LIMIT 1) AS clientname
                   FROM hearings hx
                   JOIN judge jx ON jx.judgeid = hx.judgeid
                   JOIN users ju ON ju.userid = jx.userid
                   WHERE hx.hearingid = %s
                   LIMIT 1""",
                (caseid, caseid, hearing["hearingid"]),
            )
            people = cur.fetchone() or {}
            result.append({
                "hearingid": hearing["hearingid"],
                "hearingnumber": hearing["hearingid"],
                "id": hearing["hearingid"],
                "caseid": caseid,
                "casename": hearing.get("casename") or hearing.get("title"),
                "casetitle": hearing.get("casename") or hearing.get("title"),
                "courtname": hearing.get("courtname") or hearing.get("venue") or "N/A",
                "hearingdate": (
                    hearing["hearingdate"].isoformat()
                    if hearing["hearingdate"]
                    else None
                ),
                "hearingtime": (
                    hearing["hearingtime"].strftime("%H:%M")
                    if hearing["hearingtime"]
                    else None
                ),
                "venue": hearing.get("venue"),
                "hearingstatus": hearing.get("hearingstatus") or "scheduled",
                "status": hearing.get("hearingstatus") or "scheduled",
                "judgename": people.get("judgename") or "N/A",
                "lawyernames": people.get("lawyernames") or "N/A",
                "clientname": people.get("clientname") or "N/A",
                **({"remarks": hearing.get("remarks") or ""} if role == "Judge" else {}),
            })

        return jsonify({"hearings": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/hearings", methods=["POST"])
@login_required
def schedule_hearing():
    data = request.get_json() or {}
    caseid = data.get("caseid")
    hearingdate = data.get("hearingdate") or data.get("hearingDate")
    hearingtime = data.get("hearingtime") or data.get("hearingTime")

    if not all([caseid, hearingdate, hearingtime]):
        return jsonify({"error": "Missing required fields"}), 400

    if (current_user.role or "").lower() != "judge":
        return jsonify({"error": "Only judges can schedule hearings"}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()

        cur.execute("SELECT judgeid FROM judge WHERE userid = %s", (current_user.userid,))
        judge_row = cur.fetchone()
        if not judge_row:
            return jsonify({"error": "Judge profile not found"}), 404
        judgeid = judge_row[0]

        cur.execute(
            """SELECT c.caseid, c.title
               FROM cases c
               JOIN judgeaccess ja ON ja.caseid = c.caseid
               WHERE c.caseid = %s AND ja.judgeid = %s""",
            (caseid, judgeid),
        )
        case_row = cur.fetchone()
        if not case_row:
            return jsonify({"error": "Case not found or not assigned to you"}), 404
        casetitle = case_row[1]

        cur.execute(
            "SELECT hearingid, hearingdate FROM hearings WHERE caseid = %s AND hearingstatus = 'scheduled' LIMIT 1",
            (caseid,),
        )
        existing_hearing = cur.fetchone()
        if existing_hearing:
            return jsonify({
                "error": "A hearing is already scheduled for this case",
                "hearingid": existing_hearing[0],
                "hearingdate": existing_hearing[1].isoformat() if existing_hearing[1] else None,
            }), 409

        cur.execute(
            "SELECT COALESCE(MAX(hearingid), 0) + 1 FROM hearings"
        )
        next_hid = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO hearings (caseid, hearingid, judgeid, hearingdate, hearingtime, remarks)
            VALUES (%s, %s, %s, %s, %s, NULL)
            """,
            (caseid, next_hid, judgeid, hearingdate, hearingtime),
        )
        conn.commit()

        # Notify lawyers and clients on the case
        try:
            from utils.notifications import push_notification
            cur.execute(
                "SELECT l.userid FROM lawyer l JOIN caselawyeraccess cla ON cla.lawyerid = l.lawyerid WHERE cla.caseid = %s",
                (caseid,),
            )
            for row in cur.fetchall():
                push_notification(row[0], "Hearing Scheduled",
                    f'A hearing has been scheduled for case "{casetitle}" on {hearingdate}.', "info", caseid)
            cur.execute(
                "SELECT cp.userid FROM caseparticipant cp JOIN caseparticipantaccess cpa ON cpa.participantid = cp.participantid WHERE cpa.caseid = %s",
                (caseid,),
            )
            for row in cur.fetchall():
                push_notification(row[0], "Hearing Scheduled",
                    f'A hearing has been scheduled for your case "{casetitle}" on {hearingdate}.', "info", caseid)
        except Exception:
            pass

        return jsonify({
            "message": "Hearing scheduled successfully",
            "hearing": {
                "hearingid": next_hid,
                "caseid": int(caseid),
                "casename": casetitle,
                "hearingdate": hearingdate,
                "hearingtime": hearingtime,
                "hearingstatus": "scheduled",
            },
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/hearings/<int:hearing_id>", methods=["PUT"])
@login_required
def reschedule_hearing(hearing_id):
    if (current_user.role or "").lower() != "judge":
        return jsonify({"error": "Only judges can update hearings"}), 403

    data = request.get_json() or {}
    hearingdate = data.get("hearingdate") or data.get("hearingDate")
    hearingtime = data.get("hearingtime") or data.get("hearingTime")
    if not hearingdate or not hearingtime:
        return jsonify({"error": "Hearing date and time are required"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            """UPDATE hearings h
               SET hearingdate = %s, hearingtime = %s
               FROM judge j
               WHERE h.judgeid = j.judgeid
                 AND h.hearingid = %s
                 AND j.userid = %s
                 AND h.hearingstatus = 'scheduled'
               RETURNING h.caseid""",
            (hearingdate, hearingtime, hearing_id, current_user.userid),
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "Scheduled hearing not found or not assigned to you"}), 404
        conn.commit()
        return jsonify({
            "message": "Hearing updated successfully",
            "hearing": {
                "hearingid": hearing_id,
                "caseid": updated[0],
                "hearingdate": hearingdate,
                "hearingtime": hearingtime,
                "hearingstatus": "scheduled",
            },
        }), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/hearings/remarks", methods=["PUT"])
@login_required
def update_hearing_remarks():
    if (current_user.role or "").lower() != "judge":
        return jsonify({"error": "Only judges can update hearing remarks"}), 403
    hearing_id = request.args.get("hearingid")
    if not hearing_id:
        return jsonify({"error": "hearingid query parameter is required"}), 400

    data = request.get_json() or {}
    remarks = data.get("remarks")
    if remarks is None:
        return jsonify({"error": "remarks field is required in JSON body"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            """UPDATE hearings h
               SET remarks = %s
               FROM judge j
               WHERE h.judgeid = j.judgeid
                 AND h.hearingid = %s
                 AND j.userid = %s""",
            (remarks, hearing_id, current_user.userid),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Hearing not found"}), 404
        conn.commit()
        return jsonify({"message": "Remarks updated successfully"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/hearings/<int:hearing_id>/status", methods=["PATCH"])
@login_required
def update_hearing_status(hearing_id):
    if current_user.role not in ("CourtRegistrar", "Judge", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json() or {}
    new_status = data.get("status", "").strip()
    valid_statuses = ["scheduled", "completed", "adjourned", "cancelled"]
    if new_status.lower() not in valid_statuses:
        return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE hearings SET hearingstatus = %s WHERE hearingid = %s",
            (new_status.lower(), hearing_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Hearing not found"}), 404
        conn.commit()

        # Notify lawyers and clients on the case
        try:
            from utils.notifications import push_notification
            cur.execute("SELECT caseid FROM hearings WHERE hearingid = %s", (hearing_id,))
            h = cur.fetchone()
            if h:
                cid = h[0]
                label = new_status.capitalize()
                cur.execute(
                    "SELECT l.userid FROM lawyer l JOIN caselawyeraccess cla ON cla.lawyerid = l.lawyerid WHERE cla.caseid = %s",
                    (cid,),
                )
                for row in cur.fetchall():
                    push_notification(row[0], "Hearing Updated",
                        f"A hearing status has been updated to {label}.", "info", hearing_id)
                cur.execute(
                    "SELECT cp.userid FROM caseparticipant cp JOIN caseparticipantaccess cpa ON cpa.participantid = cp.participantid WHERE cpa.caseid = %s",
                    (cid,),
                )
                for row in cur.fetchall():
                    push_notification(row[0], "Hearing Updated",
                        f"The status of a hearing on your case has been updated to {label}.", "info", hearing_id)
        except Exception:
            pass

        return jsonify({"message": "Hearing status updated"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route(
    '/hearings/addvenue',
    methods=['PUT']
)
@login_required
def add_hearing_venue():

    data = request.get_json()

    hearing_id = data.get("hearingid")
    venue = data.get("venue")

    if not hearing_id:
        return jsonify({
            "success": False,
            "message": "hearingid required"
        }), 400

    conn = None

    try:

        conn = get_pg_connection()

        cur = conn.cursor()

        cur.execute(
            """
            UPDATE hearings
            SET venue=%s
            WHERE hearingid=%s
            """,
            (
                venue,
                hearing_id
            )
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Venue updated successfully"
        })

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

    finally:

        if conn:
            conn.close()
