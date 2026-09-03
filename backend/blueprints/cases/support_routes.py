"""Lawyer dashboard support routes migrated from the original monolithic app."""
import datetime

import psycopg2.extras
from flask import jsonify, request
from flask_login import login_required, current_user

from blueprints.cases import cases_bp
from db.db import SessionLocal, get_pg_connection
from models import (
    Cases,
    Courtregistrar,
    Evidence,
    Lawyer,
    Witnesscase,
    Witnesses,
    t_caselawyeraccess,
    t_courtaccess,
)


@cases_bp.route("/lawyerappeals", methods=["GET"])
@login_required
def get_lawyerappeals():
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT lawyerid FROM lawyer WHERE userid = %s;",
            (current_user.userid,),
        )
        lawyer_row = cur.fetchone()
        if not lawyer_row:
            return jsonify({"appeals": []}), 200

        cur.execute(
            """
            SELECT
                a.appealdate,
                a.appealstatus,
                a.decisiondate,
                a.decision,
                c.title AS casename,
                ct.courtname
            FROM appeals a
            JOIN cases c ON c.caseid = a.caseid
            JOIN courtaccess ca ON ca.caseid = c.caseid
            JOIN court ct ON ct.courtid = ca.courtid
            WHERE a.caseid IN (
                SELECT caseid FROM caselawyeraccess
                WHERE lawyerid = %s
                  AND (status IS NULL OR LOWER(status) = 'approved')
            )
            """,
            (lawyer_row[0],),
        )
        rows = cur.fetchall()
        result = [
            {
                "appealdate": row[0],
                "status": row[1],
                "decisiondate": row[2],
                "decision": row[3],
                "casename": row[4],
                "courtname": row[5],
            }
            for row in rows
        ]
        return jsonify({"appeals": result}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/lawyer/evidence", methods=["GET"])
@login_required
def get_evidence_for_logged_in_lawyer():
    if current_user.role != "Lawyer":
        return jsonify({"message": "Access denied: User is not a lawyer"}), 403
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT e.evidenceid AS evidence_id, e.caseid AS case_id,
                   e.evidencetype, e.description, e.filepath, e.submitteddate,
                   c.title AS casename
            FROM evidence e
            JOIN cases c ON c.caseid = e.caseid
            JOIN caselawyeraccess cla ON cla.caseid = e.caseid
            JOIN lawyer l ON l.lawyerid = cla.lawyerid
            WHERE l.userid = %s
              AND (cla.status IS NULL OR LOWER(cla.status) = 'approved')
            """,
            (current_user.userid,),
        )
        rows = cur.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            if row.get("submitteddate"):
                row["submitteddate"] = row["submitteddate"].isoformat()
            result.append(row)
        return jsonify({"evidence": result}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/witnesses", methods=["GET"])
@cases_bp.route("/witnesses/court", methods=["GET"])
@login_required
def get_all_witnesses():
    db = SessionLocal()
    try:
        role = (current_user.role or "").lower()
        if role == "lawyer":
            lawyer = db.query(Lawyer).filter_by(userid=current_user.userid).first()
            if not lawyer:
                return jsonify({"witnesses": []}), 200
            assigned_case_ids = [
                row.caseid for row in db.execute(
                    t_caselawyeraccess.select().where(
                        t_caselawyeraccess.c.lawyerid == lawyer.lawyerid
                    )
                ).fetchall()
            ]
        elif role == "courtregistrar":
            registrar = db.query(Courtregistrar).filter_by(
                userid=current_user.userid
            ).first()
            if not registrar or not registrar.courtid:
                return jsonify({"witnesses": []}), 200
            assigned_case_ids = [
                row.caseid for row in db.execute(
                    t_courtaccess.select().where(
                        t_courtaccess.c.courtid == registrar.courtid
                    )
                ).fetchall()
            ]
        else:
            return jsonify({"message": "Witness access denied"}), 403
        witnesses = (
            db.query(Witnesses)
            .join(Witnesscase, Witnesscase.witnessid == Witnesses.witnessid)
            .filter(Witnesscase.caseid.in_(assigned_case_ids))
            .distinct()
            .all()
        ) if assigned_case_ids else []
        if not witnesses:
            return jsonify({"witnesses": []}), 200

        result = []
        seen_case_witnesses = set()
        for witness in witnesses:
            witness_cases = (
                db.query(Witnesscase)
                .filter(
                    Witnesscase.witnessid == witness.witnessid,
                    Witnesscase.caseid.in_(assigned_case_ids),
                )
                .all()
            )
            cases = []
            for link in witness_cases:
                case = db.query(Cases).filter_by(caseid=link.caseid).first()
                if case:
                    duplicate_key = (
                        (witness.cnic or '').strip(),
                        case.caseid,
                    )
                    if duplicate_key in seen_case_witnesses:
                        continue
                    seen_case_witnesses.add(duplicate_key)
                    lawyer_names = [
                        (
                            f"{lawyer.users.firstname or ''} "
                            f"{lawyer.users.lastname or ''}"
                        ).strip()
                        for lawyer in case.lawyer
                        if lawyer.users
                    ]
                    cases.append(
                        {
                            "caseid": case.caseid,
                            "title": case.title,
                            "statement": link.statement,
                            "statementdate": (
                                link.statementdate.isoformat()
                                if link.statementdate else None
                            ),
                            "lawyerName": " & ".join(lawyer_names) or "N/A",
                        }
                    )
            if not cases:
                continue
            result.append(
                {
                    "witness": {
                        "id": witness.witnessid,
                        "firstname": witness.firstname,
                        "lastname": witness.lastname,
                        "cnic": witness.cnic,
                        "phone": witness.phone,
                        "email": witness.email,
                        "address": witness.address,
                        "pasthistory": witness.pasthistory,
                    },
                    "cases": cases,
                }
            )
        return jsonify({"witnesses": result}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    finally:
        db.close()


@cases_bp.route("/evidence", methods=["GET"])
@login_required
def get_all_evidence():
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                e.evidenceid    AS id,
                e.evidencetype  AS "evidenceType",
                e.description,
                e.filepath,
                e.submitteddate AS date,
                c.title         AS "caseName",
                (
                    SELECT STRING_AGG(
                        DISTINCT TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')),
                        ' & '
                    )
                    FROM caselawyeraccess cla
                    JOIN lawyer l ON l.lawyerid = cla.lawyerid
                    JOIN users u ON u.userid = l.userid
                    WHERE cla.caseid = c.caseid
                      AND (cla.status IS NULL OR LOWER(cla.status) = 'approved')
                ) AS "lawyerName"
            FROM evidence e
            JOIN cases c ON c.caseid = e.caseid
            ORDER BY e.submitteddate DESC NULLS LAST
            """
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "evidenceType": row["evidenceType"],
                "description": row["description"],
                "filepath": row["filepath"],
                "date": row["date"].isoformat() if row["date"] else None,
                "submissionDate": row["date"].isoformat() if row["date"] else None,
                "caseName": row["caseName"],
                "lawyerName": row["lawyerName"] or "N/A",
                "file": row["filepath"],
            })
        return jsonify({"evidence": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/evidence", methods=["POST"])
@login_required
def create_evidence_for_lawyer():
    if (current_user.role or "").lower() != "lawyer":
        return jsonify({"message": "Only lawyers can add evidence"}), 403
    data = request.get_json() or {}
    case_name = (data.get("casename") or "").strip()
    evidence_type = (data.get("evidencetype") or "").strip()
    description = (data.get("description") or "").strip()
    submitted = data.get("submissiondate")
    if not all((case_name, evidence_type, description, submitted)):
        return jsonify({"message": "All evidence fields are required"}), 400
    try:
        submitted_date = datetime.date.fromisoformat(submitted)
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid submission date"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT c.caseid FROM cases c JOIN caselawyeraccess cla ON cla.caseid=c.caseid
               JOIN lawyer l ON l.lawyerid=cla.lawyerid
               WHERE l.userid=%s AND LOWER(c.title)=LOWER(%s) LIMIT 2""",
            (current_user.userid, case_name),
        )
        rows = cur.fetchall()
        if not rows:
            return jsonify({"message": "Case not found or not assigned to you"}), 404
        if len(rows) > 1:
            return jsonify({"message": "More than one assigned case has that name"}), 409
        case_id = rows[0]["caseid"]
        cur.execute(
            """INSERT INTO evidence (caseid, evidencetype, description, submitteddate)
               VALUES (%s,%s,%s,%s) RETURNING evidenceid""",
            (case_id, evidence_type, description, submitted_date),
        )
        evidence_id = cur.fetchone()["evidenceid"]
        conn.commit()
        return jsonify({"message": "Evidence added successfully", "id": evidence_id}), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/evidence/<int:evidence_id>", methods=["PUT"])
@login_required
def update_evidence_for_lawyer(evidence_id):
    if (current_user.role or "").lower() != "lawyer":
        return jsonify({"message": "Only lawyers can update evidence"}), 403
    data = request.get_json() or {}
    try:
        submitted_date = datetime.date.fromisoformat(data.get("submissiondate", ""))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid submission date"}), 400
    evidence_type = (data.get("evidencetype") or "").strip()
    description = (data.get("description") or "").strip()
    if not evidence_type or not description:
        return jsonify({"message": "Evidence type and description are required"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            """SELECT 1 FROM evidence e JOIN caselawyeraccess cla ON cla.caseid=e.caseid
               JOIN lawyer l ON l.lawyerid=cla.lawyerid
               WHERE e.evidenceid=%s AND l.userid=%s""",
            (evidence_id, current_user.userid),
        )
        if not cur.fetchone():
            return jsonify({"message": "Evidence not found or not assigned to you"}), 404
        cur.execute(
            "UPDATE evidence SET evidencetype=%s, description=%s, submitteddate=%s WHERE evidenceid=%s",
            (evidence_type, description, submitted_date, evidence_id),
        )
        conn.commit()
        return jsonify({"message": "Evidence updated successfully"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/witnesses", methods=["POST"])
@login_required
def create_witness_for_lawyer():
    if (current_user.role or "").lower() != "lawyer":
        return jsonify({"message": "Only lawyers can add witnesses"}), 403
    data = request.get_json() or {}
    required = ("firstname", "lastname", "cnic", "phone", "email", "address", "casename", "statement", "statementdate")
    missing = [field for field in required if not str(data.get(field) or "").strip()]
    if missing:
        return jsonify({"message": f"Missing required fields: {', '.join(missing)}"}), 400
    try:
        statement_date = datetime.date.fromisoformat(data["statementdate"])
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid statement date"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT c.caseid FROM cases c JOIN caselawyeraccess cla ON cla.caseid=c.caseid
               JOIN lawyer l ON l.lawyerid=cla.lawyerid
               WHERE l.userid=%s AND LOWER(c.title)=LOWER(%s) LIMIT 2""",
            (current_user.userid, data["casename"].strip()),
        )
        rows = cur.fetchall()
        if not rows:
            return jsonify({"message": "Case not found or not assigned to you"}), 404
        case_id = rows[0]["caseid"]
        normalized_cnic = str(data["cnic"]).strip()
        cur.execute(
            """SELECT w.witnessid
               FROM witnesses w
               JOIN witnesscase wc ON wc.witnessid = w.witnessid
               WHERE w.cnic = %s AND wc.caseid = %s
               LIMIT 1""",
            (normalized_cnic, case_id),
        )
        if cur.fetchone():
            return jsonify({
                "message": "This witness is already attached to that case"
            }), 409
        cur.execute(
            """INSERT INTO witnesses (firstname, lastname, cnic, phone, email, address, pasthistory)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING witnessid""",
            tuple((data.get(k) or "").strip() for k in
                  ("firstname", "lastname", "cnic", "phone", "email", "address", "pasthistory")),
        )
        witness_id = cur.fetchone()["witnessid"]
        cur.execute(
            """INSERT INTO witnesscase (witnessid, caseid, statement, statementdate)
               VALUES (%s,%s,%s,%s)""",
            (witness_id, case_id, data["statement"].strip(), statement_date),
        )
        conn.commit()
        return jsonify({
            "message": "Witness added successfully",
            "id": witness_id,
            "caseid": case_id,
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()


@cases_bp.route("/witnesses/<int:witness_id>/<int:case_id>", methods=["PUT"])
@login_required
def update_witness_for_lawyer(witness_id, case_id):
    if (current_user.role or "").lower() != "lawyer":
        return jsonify({"message": "Only lawyers can update witnesses"}), 403
    data = request.get_json() or {}
    try:
        statement_date = datetime.date.fromisoformat(data.get("statementdate", ""))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid statement date"}), 400
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            """SELECT 1 FROM witnesscase wc JOIN caselawyeraccess cla ON cla.caseid=wc.caseid
               JOIN lawyer l ON l.lawyerid=cla.lawyerid
               WHERE wc.witnessid=%s AND wc.caseid=%s AND l.userid=%s""",
            (witness_id, case_id, current_user.userid),
        )
        if not cur.fetchone():
            return jsonify({"message": "Witness record not found or not assigned to you"}), 404
        cur.execute(
            """UPDATE witnesses SET firstname=%s, lastname=%s, cnic=%s, phone=%s,
               email=%s, address=%s, pasthistory=%s WHERE witnessid=%s""",
            tuple((data.get(k) or "").strip() for k in
                  ("firstname", "lastname", "cnic", "phone", "email", "address", "pasthistory")) + (witness_id,),
        )
        cur.execute(
            "UPDATE witnesscase SET statement=%s, statementdate=%s WHERE witnessid=%s AND caseid=%s",
            ((data.get("statement") or "").strip(), statement_date, witness_id, case_id),
        )
        conn.commit()
        return jsonify({"message": "Witness updated successfully"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": str(e)}), 500
    finally:
        if conn:
            conn.close()
