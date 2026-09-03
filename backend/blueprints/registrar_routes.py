from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from db.db import get_pg_connection
import psycopg2.extras

registrar_bp = Blueprint('registrar', __name__)


def _registrar_court_id(cur, userid):
    cur.execute(
        "SELECT courtid FROM courtregistrar WHERE userid = %s",
        (userid,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return row["courtid"] if isinstance(row, dict) else row[0]


@registrar_bp.route('/merge-cases', methods=['POST'])
@login_required
def merge_cases():
    if current_user.role != 'CourtRegistrar':
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    keep_id = data.get('keep_id')
    discard_id = data.get('discard_id')

    try:
        keep_id = int(keep_id)
        discard_id = int(discard_id)
    except (TypeError, ValueError):
        return jsonify({
            'error': 'keep_id and discard_id must be integers'
        }), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute('SELECT merge_cases(%s, %s)', (keep_id, discard_id))
        conn.commit()
        return jsonify({'message': 'Cases merged successfully'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500

    finally:
        if conn:
            conn.close()


@registrar_bp.route('/join-requests', methods=['GET'])
@login_required
def list_join_requests():
    if current_user.role != 'CourtRegistrar':
        return jsonify({'error': 'Forbidden'}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        court_id = _registrar_court_id(cur, current_user.userid)
        if court_id is None:
            return jsonify([]), 200

        cur.execute(
            """
            SELECT
                cla.caseid,
                c.title AS case_name,
                c.casenumber,
                cla.lawyerid,
                COALESCE(
                         TRIM(u.firstname || ' ' || u.lastname),
                         'N/A'
                ) AS lawyer_name,
                cla.side,
                COALESCE(
                    (
                        SELECT TRIM(cu.firstname || ' ' || cu.lastname)
                        FROM caseparticipantaccess cpa
                        JOIN caseparticipant cp ON cp.participantid = cpa.participantid
                        JOIN users cu ON cu.userid = cp.userid
                        WHERE cpa.caseid = cla.caseid AND cp.lawyerid = cla.lawyerid
                        LIMIT 1
                    ),
                    'N/A'
                ) AS new_client
            FROM caselawyeraccess cla
            JOIN cases c ON cla.caseid = c.caseid
            JOIN courtaccess ca ON ca.caseid = c.caseid AND ca.courtid = %s
            LEFT JOIN lawyer l ON cla.lawyerid = l.lawyerid
            LEFT JOIN users u ON l.userid = u.userid
            WHERE LOWER(cla.status) = 'pending'
            ORDER BY cla.caseid
            """,
            (court_id,),
        )

        rows = cur.fetchall()
        results = [dict(r) for r in rows]
        return jsonify(results), 200

    except Exception as e:
        print("JOIN REQUEST ERROR:", e)

        if conn:
            conn.rollback()

        return jsonify({'error': str(e)}), 500

    finally:
        if conn:
            conn.close()


@registrar_bp.route('/join-requests/<int:lawyerid>/<int:caseid>/approve', methods=['POST'])
@login_required
def approve_join_request(lawyerid, caseid):
    if current_user.role != 'CourtRegistrar':
        return jsonify({'error': 'Forbidden'}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        court_id = _registrar_court_id(cur, current_user.userid)
        if court_id is None:
            return jsonify({'error': 'Registrar profile not found'}), 404

        cur.execute(
            "SELECT 1 FROM courtaccess WHERE caseid = %s AND courtid = %s",
            (caseid, court_id),
        )
        if not cur.fetchone():
            return jsonify({'error': 'Case is not assigned to your court'}), 403

        cur.execute(
            """
            UPDATE caselawyeraccess
            SET status = 'approved', is_lead = FALSE
            WHERE lawyerid = %s AND caseid = %s AND LOWER(status) = 'pending'
            """,
            (lawyerid, caseid),
        )
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify({'error': 'Join request not found'}), 404

        conn.commit()

        from utils.logging import write_log
        write_log(
            "UPDATE",
            f"Registrar approved lawyer {lawyerid} joining case {caseid}",
            "case",
        )

        try:
            from utils.notifications import push_notification
            cur.execute(
                """
                SELECT u.userid, c.title FROM lawyer l
                JOIN users u ON u.userid = l.userid
                JOIN cases c ON c.caseid = %s
                WHERE l.lawyerid = %s
                """,
                (caseid, lawyerid),
            )
            info = cur.fetchone()
            if info:
                push_notification(
                    info['userid'],
                    "Join Request Approved",
                    f"Your request to join case \"{info['title']}\" has been approved.",
                    "success",
                    caseid,
                )
        except Exception:
            pass

        return jsonify({'message': 'Join request approved'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500

    finally:
        if conn:
            conn.close()


@registrar_bp.route('/join-requests/<int:lawyerid>/<int:caseid>/reject', methods=['POST'])
@login_required
def reject_join_request(lawyerid, caseid):
    if current_user.role != 'CourtRegistrar':
        return jsonify({'error': 'Forbidden'}), 403

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        court_id = _registrar_court_id(cur, current_user.userid)
        if court_id is None:
            return jsonify({'error': 'Registrar profile not found'}), 404

        cur.execute(
            "SELECT 1 FROM courtaccess WHERE caseid = %s AND courtid = %s",
            (caseid, court_id),
        )
        if not cur.fetchone():
            return jsonify({'error': 'Case is not assigned to your court'}), 403

        cur.execute(
            """
            SELECT u.userid, c.title FROM lawyer l
            JOIN users u ON u.userid = l.userid
            JOIN cases c ON c.caseid = %s
            WHERE l.lawyerid = %s
            """,
            (caseid, lawyerid),
        )
        info = cur.fetchone()

        cur.execute(
            """
            DELETE FROM caselawyeraccess
            WHERE lawyerid = %s AND caseid = %s AND LOWER(status) = 'pending'
            """,
            (lawyerid, caseid),
        )
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify({'error': 'Join request not found'}), 404

        conn.commit()

        try:
            from utils.notifications import push_notification
            if info:
                push_notification(
                    info['userid'],
                    "Join Request Rejected",
                    f"Your request to join case \"{info['title']}\" was rejected by the registrar.",
                    "warning",
                    caseid,
                )
        except Exception:
            pass

        return jsonify({'message': 'Join request rejected'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500

    finally:
        if conn:
            conn.close()
