from flask import jsonify, request
from flask_login import login_required, current_user

import psycopg2
import psycopg2.extras
from werkzeug.security import generate_password_hash

from db.db import get_pg_connection, SessionLocal
from models import Judge

from blueprints.legal_actors import legal_actors_bp

@legal_actors_bp.route('/judges', methods=['GET'])
@login_required
def get_judges_for_court():
    conn = None
    try:
        conn = get_pg_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT courtid FROM courtregistrar WHERE userid = %s",
                (current_user.userid,),
            )
            court = cur.fetchone()
            if not court:
                return jsonify({"judges": []}), 200

            cur.execute(
                """
                SELECT j.judgeid, u.firstname, u.lastname, j.position,
                       j.expyears, j.appointmentdate, j.specialization
                FROM judge j
                JOIN users u ON u.userid = j.userid
                JOIN judgeworksin jw ON jw.judgeid = j.judgeid
                WHERE jw.courtid = %s
                """,
                (court["courtid"],),
            )
            judges = cur.fetchall()

            response = []
            for judge in judges:
                cur.execute(
                    """
                    SELECT c.title
                    FROM judgeaccess ja
                    JOIN cases c ON ja.caseid = c.caseid
                    WHERE ja.judgeid = %s
                    """,
                    (judge["judgeid"],),
                )
                assigned_titles = [c["title"] for c in cur.fetchall()]
                response.append(
                    {
                        "judgeid": judge["judgeid"],
                        "name": f"{judge['firstname']} {judge['lastname']}",
                        "position": judge["position"],
                        "expyears": judge["expyears"],
                        "appointmentdate": (
                            judge["appointmentdate"].isoformat()
                            if judge["appointmentdate"]
                            else None
                        ),
                        "specialization": judge["specialization"],
                        "assigned_cases": assigned_titles,
                    }
                )
        return jsonify({"judges": response})
    finally:
        if conn:
            conn.close()


# ==========================================================
# LIST JUDGES AVAILABLE TO ASSIGN (Registrar only)
#
# Judges are never created here — a judge only exists via normal signup
# + OTP + Admin approval (same as everyone else). This just lists every
# already-approved judge who isn't already linked to the registrar's own
# court, so the registrar can link ("assign") one. A judge can legitimately
# work at more than one court at a time (real-world judges do), so this
# is additive, not exclusive — the list surfaces each judge's *other*
# current court(s) for context, sorted so judges already near the
# registrar's own court's location come first (best-effort text match on
# the free-text location field, not a hard jurisdiction rule).
# ==========================================================
@legal_actors_bp.route('/judges/available', methods=['GET'])
@login_required
def list_available_judges():
    if current_user.role != 'CourtRegistrar':
        return jsonify({"message": "Court registrar access required"}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT cr.courtid, c.location FROM courtregistrar cr JOIN court c ON c.courtid = cr.courtid WHERE cr.userid = %s", (current_user.userid,))
        registrar = cur.fetchone()
        if not registrar:
            return jsonify({"message": "Registrar is not assigned to a court"}), 400
        my_courtid = registrar['courtid']
        my_location = (registrar['location'] or '').lower()

        cur.execute(
            """
            SELECT j.judgeid, u.firstname, u.lastname, j.position, j.specialization, j.expyears,
                   COALESCE(
                       STRING_AGG(DISTINCT c.courtname || ' (' || c.location || ')', ', ')
                       FILTER (WHERE c.courtid IS NOT NULL),
                       ''
                   ) AS current_courts,
                   STRING_AGG(DISTINCT c.location, ', ') FILTER (WHERE c.courtid IS NOT NULL) AS current_locations
            FROM judge j
            JOIN users u ON u.userid = j.userid
            LEFT JOIN judgeworksin jw ON jw.judgeid = j.judgeid
            LEFT JOIN court c ON c.courtid = jw.courtid
            WHERE u.role = 'Judge' AND u.approval_status = 'approved'
              AND NOT EXISTS (
                  SELECT 1 FROM judgeworksin jw2
                  WHERE jw2.judgeid = j.judgeid AND jw2.courtid = %s
              )
            GROUP BY j.judgeid, u.firstname, u.lastname, j.position, j.specialization, j.expyears
            ORDER BY u.firstname, u.lastname
            """,
            (my_courtid,),
        )
        judges = [dict(r) for r in cur.fetchall()]

        # Best-effort "nearby first" sort — not a hard jurisdiction filter,
        # since court.location is free text with no standardized city field.
        def same_area(j):
            locs = (j.get('current_locations') or '').lower()
            return 0 if (my_location and my_location in locs) else 1

        judges.sort(key=same_area)

        return jsonify({"judges": judges}), 200
    except Exception as exc:
        return jsonify({"message": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# ASSIGN AN EXISTING JUDGE TO MY COURT (Registrar only)
# ==========================================================
@legal_actors_bp.route('/judges/<int:judge_id>/assign', methods=['POST'])
@login_required
def assign_judge_to_court(judge_id):
    if current_user.role != 'CourtRegistrar':
        return jsonify({"message": "Court registrar access required"}), 403

    data = request.get_json() or {}
    case_names = data.get('assignedCases') or []

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT courtid FROM courtregistrar WHERE userid = %s", (current_user.userid,))
        registrar = cur.fetchone()
        if not registrar or not registrar['courtid']:
            return jsonify({"message": "Registrar is not assigned to a court"}), 400

        cur.execute(
            "SELECT 1 FROM judge j JOIN users u ON u.userid = j.userid "
            "WHERE j.judgeid = %s AND u.role = 'Judge' AND u.approval_status = 'approved'",
            (judge_id,),
        )
        if not cur.fetchone():
            return jsonify({"message": "Judge not found or not yet approved"}), 404

        cur.execute(
            "INSERT INTO judgeworksin (judgeid, courtid) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (judge_id, registrar['courtid']),
        )

        if case_names:
            cur.execute(
                """
                SELECT c.caseid FROM cases c
                JOIN courtaccess ca ON ca.caseid = c.caseid
                WHERE ca.courtid = %s AND c.title = ANY(%s)
                """,
                (registrar['courtid'], case_names),
            )
            for case_row in cur.fetchall():
                cur.execute(
                    "INSERT INTO judgeaccess (caseid, judgeid) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (case_row['caseid'], judge_id),
                )

        conn.commit()
        return jsonify({"message": "Judge assigned to your court"}), 201
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"message": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# UPDATE A JUDGE'S CASE ASSIGNMENTS AT MY COURT (Registrar only)
#
# Only case assignments — never the judge's own name/position/
# specialization/experience. Those belong to the judge's own profile
# (PUT /api/judgeprofile), which they manage themselves.
# ==========================================================
@legal_actors_bp.route('/judges/<int:judge_id>/assignments', methods=['PUT'])
@login_required
def update_judge_case_assignments(judge_id):
    if current_user.role != 'CourtRegistrar':
        return jsonify(success=False, message="Court registrar access required"), 403

    data = request.get_json() or {}
    assigned_cases = data.get('assignedCases') or []

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT courtid FROM courtregistrar WHERE userid = %s", (current_user.userid,))
        registrar = cur.fetchone()
        if not registrar or not registrar['courtid']:
            return jsonify(success=False, message="Registrar is not assigned to a court"), 400

        cur.execute(
            "SELECT 1 FROM judgeworksin WHERE judgeid = %s AND courtid = %s",
            (judge_id, registrar['courtid']),
        )
        if not cur.fetchone():
            return jsonify(success=False, message="Judge not found in your court"), 404

        cur.execute(
            """
            DELETE FROM judgeaccess ja
            USING courtaccess ca
            WHERE ja.caseid = ca.caseid
              AND ja.judgeid = %s
              AND ca.courtid = %s
            """,
            (judge_id, registrar['courtid']),
        )
        if assigned_cases:
            cur.execute(
                """
                SELECT c.caseid FROM cases c
                JOIN courtaccess ca ON ca.caseid = c.caseid
                WHERE ca.courtid = %s AND c.title = ANY(%s)
                """,
                (registrar['courtid'], assigned_cases),
            )
            for case_row in cur.fetchall():
                cur.execute(
                    "INSERT INTO judgeaccess (caseid, judgeid) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (case_row['caseid'], judge_id),
                )

        conn.commit()
        return jsonify(success=True, message="Case assignments updated successfully"), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify(success=False, message=str(exc)), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# REMOVE A JUDGE FROM MY COURT (Registrar only)
#
# A judge with open/in-progress cases at this court can't just be pulled
# off it — that would silently leave those cases with no judge. Block the
# removal and make the registrar reassign those cases to another judge
# first. Closed cases are historical record and don't block removal, and
# their judgeaccess rows are left untouched (who presided over a closed
# case shouldn't change just because the judge later leaves the court).
# ==========================================================
@legal_actors_bp.route('/judges/<int:judge_id>/court', methods=['DELETE'])
@login_required
def remove_judge_from_court(judge_id):
    if current_user.role != 'CourtRegistrar':
        return jsonify(success=False, message="Court registrar access required"), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT courtid FROM courtregistrar WHERE userid = %s", (current_user.userid,))
        registrar = cur.fetchone()
        if not registrar or not registrar['courtid']:
            return jsonify(success=False, message="Registrar is not assigned to a court"), 400

        cur.execute(
            """
            SELECT c.title FROM judgeaccess ja
            JOIN courtaccess ca ON ca.caseid = ja.caseid
            JOIN cases c ON c.caseid = ja.caseid
            WHERE ja.judgeid = %s AND ca.courtid = %s AND LOWER(c.status) != 'closed'
            """,
            (judge_id, registrar['courtid']),
        )
        active_cases = [row['title'] for row in cur.fetchall()]
        if active_cases:
            return jsonify(
                success=False,
                message=(
                    f"This judge still has {len(active_cases)} active case(s) at your court "
                    f"({', '.join(active_cases)}) — reassign them to another judge before removing."
                ),
            ), 409

        cur.execute(
            "DELETE FROM judgeworksin WHERE judgeid = %s AND courtid = %s RETURNING judgeid",
            (judge_id, registrar['courtid']),
        )
        if not cur.fetchone():
            return jsonify(success=False, message="Judge not found in your court"), 404

        conn.commit()
        return jsonify(success=True, message="Judge removed from your court"), 200
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify(success=False, message=str(exc)), 500
    finally:
        if conn:
            conn.close()

# ==========================================================
# GET LAWYERS (for registrar case verification / assignments)
# ==========================================================
@legal_actors_bp.route('/lawyers', methods=['GET'])
@login_required
def get_lawyers():
    conn = None
    try:
        conn = get_pg_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT l.lawyerid, u.firstname, u.lastname, l.specialization
                FROM lawyer l
                JOIN users u ON u.userid = l.userid
                ORDER BY u.firstname, u.lastname
                """
            )
            rows = cur.fetchall()
        lawyers = [
            {
                'lawyerid': row['lawyerid'],
                'id': row['lawyerid'],
                'firstname': row['firstname'],
                'lastname': row['lastname'],
                'name': f"{row['firstname']} {row['lastname']}".strip(),
                'specialization': row['specialization'],
            }
            for row in rows
        ]
        return jsonify({'lawyers': lawyers}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# SEARCH REGISTERED CLIENTS (for case filing / join-request pickers)
# ==========================================================
@legal_actors_bp.route('/clients', methods=['GET'])
@login_required
def search_clients():
    """Search already-registered clients (users who signed up with the
    CaseParticipant role) by name or CNIC. Used so lawyers can only attach
    real, existing clients to a case instead of typing a free-text name."""
    query = (request.args.get('query') or '').strip()

    conn = None
    try:
        conn = get_pg_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            if query:
                like_q = f"%{query}%"
                cur.execute(
                    """
                    SELECT cp.participantid, u.userid, u.firstname, u.lastname, u.cnic, u.email
                    FROM caseparticipant cp
                    JOIN users u ON u.userid = cp.userid
                    WHERE u.firstname ILIKE %s
                       OR u.lastname ILIKE %s
                       OR (u.firstname || ' ' || u.lastname) ILIKE %s
                       OR u.cnic ILIKE %s
                    ORDER BY u.firstname, u.lastname
                    LIMIT 20
                    """,
                    (like_q, like_q, like_q, like_q),
                )
            else:
                cur.execute(
                    """
                    SELECT cp.participantid, u.userid, u.firstname, u.lastname, u.cnic, u.email
                    FROM caseparticipant cp
                    JOIN users u ON u.userid = cp.userid
                    ORDER BY u.firstname, u.lastname
                    LIMIT 20
                    """
                )
            rows = cur.fetchall()

        clients = [
            {
                'participantid': row['participantid'],
                'userid': row['userid'],
                'name': f"{row['firstname'] or ''} {row['lastname'] or ''}".strip(),
                'cnic': row['cnic'],
                'email': row['email'],
            }
            for row in rows
        ]
        return jsonify({'clients': clients}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==========================================================
# GET PROSECUTORS
# ==========================================================
@legal_actors_bp.route('/prosecutors', methods=['GET'])
@login_required
def get_prosecutors():

    conn = None

    try:

        conn = get_pg_connection()

        with conn.cursor(
            cursor_factory=psycopg2.extras.DictCursor
        ) as cur:

            cur.execute(
                """
                SELECT courtid
                FROM courtregistrar
                WHERE userid=%s
                """,
                (current_user.userid,)
            )

            row = cur.fetchone()

            if not row:
                return jsonify({
                    "error": "Registrar not found"
                }), 404

            court_id = row["courtid"]

            cur.execute(
                """
                SELECT *
                FROM prosecutor
                WHERE courtid = %s
                """,
                (court_id,)
            )

            prosecutors = cur.fetchall()

            cur.execute(
                """
                SELECT
                    p.prosecutorid,
                    c.title
                FROM prosecutorassign pa
                JOIN prosecutor p
                    ON pa.prosecutorid = p.prosecutorid
                JOIN cases c
                    ON pa.caseid = c.caseid
                JOIN courtaccess ca
                    ON ca.caseid = c.caseid
                WHERE ca.courtid = %s
                """,
                (court_id,)
            )

            assignments = cur.fetchall()

        prosecutor_case_map = {}

        for row in assignments:

            pid = row["prosecutorid"]

            prosecutor_case_map.setdefault(
                pid,
                []
            ).append(
                row["title"]
            )

        result = []

        for p in prosecutors:

            assigned = prosecutor_case_map.get(
                p["prosecutorid"],
                []
            )

            result.append({
                "id": p["prosecutorid"],
                "name": p["name"],
                "experience": p["experience"],
                "status": p["status"],
                "assignedCases": assigned
            })

        return jsonify({
            "prosecutors": result
        }), 200

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ==========================================================
# CREATE PROSECUTOR
# ==========================================================
@legal_actors_bp.route('/prosecutor', methods=['POST'])
@login_required
def create_prosecutor():

    if current_user.role != 'CourtRegistrar':
        return jsonify({"error": "Court registrar access required"}), 403

    data = request.get_json()

    name = data.get('name')
    experience = data.get('experience')
    status = data.get('status')
    case_names = data.get('case_names', [])

    if not name or experience is None or status is None:
        return jsonify({
            "error": "Missing required fields"
        }), 400

    conn = None

    try:

        conn = get_pg_connection()

        cur = conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        )

        cur.execute(
            "SELECT courtid FROM courtregistrar WHERE userid = %s",
            (current_user.userid,),
        )
        reg_row = cur.fetchone()
        if not reg_row or not reg_row["courtid"]:
            return jsonify({"error": "Registrar profile or court not found"}), 404
        court_id = reg_row["courtid"]

        cur.execute(
            """
            INSERT INTO prosecutor
            (
                name,
                experience,
                status,
                courtid
            )
            VALUES (%s,%s,%s,%s)
            RETURNING prosecutorid
            """,
            (
                name,
                experience,
                status,
                court_id,
            )
        )

        prosecutor_row = cur.fetchone()

        prosecutor_id = prosecutor_row["prosecutorid"]

        if case_names:

            cur.execute(
                """
                SELECT c.title
                FROM cases c
                JOIN courtaccess ca ON ca.caseid = c.caseid
                WHERE ca.courtid = (
                    SELECT courtid FROM courtregistrar WHERE userid = %s
                )
                  AND LOWER(COALESCE(c.casetype, '')) = 'criminal'
                  AND c.title = ANY(%s)
                """,
                (current_user.userid, case_names)
            )
            allowed_names = {row["title"] for row in cur.fetchall()}
            invalid_names = sorted(set(case_names) - allowed_names)
            if invalid_names:
                raise ValueError(
                    "Prosecutors may only be assigned to criminal cases in your court: "
                    + ", ".join(invalid_names)
                )

            cur.execute(
                """
                SELECT caseid
                FROM cases
                WHERE title = ANY(%s)
                """,
                (case_names,)
            )

            case_rows = cur.fetchall()

            for row in case_rows:

                cur.execute(
                    """
                    INSERT INTO prosecutorassign
                    (
                        prosecutorid,
                        caseid
                    )
                    VALUES (%s,%s)
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        prosecutor_id,
                        row["caseid"]
                    )
                )

        conn.commit()

        return jsonify({
            "id": prosecutor_id,
            "name": name,
            "experience": experience,
            "status": status,
            "assigned_cases": case_names
        }), 201

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "error": str(e)
        }), 400 if isinstance(e, ValueError) else 500

    finally:

        if conn:
            conn.close()


# ==========================================================
# UPDATE PROSECUTOR
# ==========================================================
@legal_actors_bp.route('/prosecutor', methods=['PUT'])
@login_required
def update_prosecutor():

    if current_user.role != 'CourtRegistrar':
        return jsonify({"error": "Court registrar access required"}), 403

    data = request.get_json()

    prosecutor_id = data.get('id')
    name = data.get('name')
    experience = data.get('experience')
    status = data.get('status')
    case_names = data.get('case_names', [])

    if not prosecutor_id or not name:
        return jsonify({
            "error": "Missing required fields"
        }), 400

    conn = None

    try:

        conn = get_pg_connection()

        cur = conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        )

        cur.execute(
            """
            SELECT p.prosecutorid FROM prosecutor p
            JOIN courtregistrar cr ON cr.courtid = p.courtid
            WHERE p.prosecutorid = %s AND cr.userid = %s
            """,
            (prosecutor_id, current_user.userid),
        )
        if not cur.fetchone():
            return jsonify({"error": "Prosecutor not found in your court"}), 404

        cur.execute(
            """
            UPDATE prosecutor
            SET
                name=%s,
                experience=%s,
                status=%s
            WHERE prosecutorid=%s
            """,
            (
                name,
                experience,
                status,
                prosecutor_id
            )
        )

        if case_names:
            cur.execute(
                """
                SELECT c.title
                FROM cases c
                JOIN courtaccess ca ON ca.caseid = c.caseid
                WHERE ca.courtid = (
                    SELECT courtid FROM courtregistrar WHERE userid = %s
                )
                  AND LOWER(COALESCE(c.casetype, '')) = 'criminal'
                  AND c.title = ANY(%s)
                """,
                (current_user.userid, case_names)
            )
            allowed_names = {row["title"] for row in cur.fetchall()}
            invalid_names = sorted(set(case_names) - allowed_names)
            if invalid_names:
                raise ValueError(
                    "Prosecutors may only be assigned to criminal cases in your court: "
                    + ", ".join(invalid_names)
                )

        cur.execute(
            """
            DELETE FROM prosecutorassign
            WHERE prosecutorid=%s
            """,
            (prosecutor_id,)
        )

        if case_names:

            cur.execute(
                """
                SELECT caseid
                FROM cases
                WHERE title = ANY(%s)
                """,
                (case_names,)
            )

            case_rows = cur.fetchall()

            for row in case_rows:

                cur.execute(
                    """
                    INSERT INTO prosecutorassign
                    (
                        prosecutorid,
                        caseid
                    )
                    VALUES (%s,%s)
                    """,
                    (
                        prosecutor_id,
                        row["caseid"]
                    )
                )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Prosecutor updated successfully"
        })

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "error": str(e)
        }), 400 if isinstance(e, ValueError) else 500

    finally:

        if conn:
            conn.close()


# ==========================================================
# DELETE PROSECUTOR
# ==========================================================
@legal_actors_bp.route(
    '/prosecutor/<int:prosecutor_id>',
    methods=['DELETE']
)
@login_required
def delete_prosecutor(prosecutor_id):

    if current_user.role != 'CourtRegistrar':
        return jsonify({"error": "Court registrar access required"}), 403

    conn = None

    try:

        conn = get_pg_connection()

        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1 FROM prosecutor p
            JOIN courtregistrar cr ON cr.courtid = p.courtid
            WHERE p.prosecutorid = %s AND cr.userid = %s
            """,
            (prosecutor_id, current_user.userid),
        )
        if not cur.fetchone():
            return jsonify({"error": "Prosecutor not found in your court"}), 404

        cur.execute(
            """
            DELETE FROM prosecutorassign
            WHERE prosecutorid=%s
            """,
            (prosecutor_id,)
        )

        cur.execute(
            """
            DELETE FROM prosecutor
            WHERE prosecutorid=%s
            """,
            (prosecutor_id,)
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Prosecutor deleted successfully"
        })

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if conn:
            conn.close()
