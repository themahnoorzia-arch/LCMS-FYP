"""
Lightweight startup migrations — add columns/tables that may be missing
from the initial DB schema without requiring a full migration tool.
Each function is idempotent (safe to run on every startup).
"""
import logging
from db.db import get_pg_connection

logger = logging.getLogger(__name__)


def remove_documents_module():
    """Permanently remove the retired document module's database tables."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS documentcase CASCADE")
        cur.execute("DROP TABLE IF EXISTS documents CASCADE")
        conn.commit()
    except Exception as exc:
        logger.error("remove_documents_module failed: %s", exc)
    finally:
        if conn:
            conn.close()


def remove_appeals_module():
    """Permanently remove the retired appeals feature's database table.

    Appeals here never modeled real appellate procedure (escalation to a
    higher court, a new judge, a separate proceeding) — it was just a status
    flag on the same case in the same court, and had real access-control
    gaps on top of that. Removed rather than patched."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS appeals CASCADE")
        conn.commit()
    except Exception as exc:
        logger.error("remove_appeals_module failed: %s", exc)
    finally:
        if conn:
            conn.close()


def remove_bail_surety_module():
    """Permanently remove the retired bail/surety features' database tables.

    Neither had any dedicated endpoint or frontend surface — bail only
    showed up as a read-only line in the case-history timeline, and surety
    had no reachable code path at all. Removed rather than left half-built.
    `bail` is dropped before `surety` since bail holds the FK to surety,
    though CASCADE would handle either order."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS bail CASCADE")
        cur.execute("DROP TABLE IF EXISTS surety CASCADE")
        conn.commit()
    except Exception as exc:
        logger.error("remove_bail_surety_module failed: %s", exc)
    finally:
        if conn:
            conn.close()


def remove_remands_module():
    """Permanently remove the retired remands feature's database table.

    Only ever surfaced as an unused `remandstatus` field nothing in the
    frontend read. Removed rather than left half-built."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS remands CASCADE")
        conn.commit()
    except Exception as exc:
        logger.error("remove_remands_module failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_lawyer_case_status():
    """Make ordinary lawyer links approved; join requests opt into pending."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE caselawyeraccess ADD COLUMN IF NOT EXISTS status VARCHAR(20)"
        )
        cur.execute(
            "UPDATE caselawyeraccess SET status = 'approved' WHERE status IS NULL"
        )
        cur.execute(
            "ALTER TABLE caselawyeraccess ALTER COLUMN status SET DEFAULT 'approved'"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_lawyer_case_status failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_unique_user_email():
    """Enforce one account per email at the DB level.

    Safe to run repeatedly. If duplicate emails already exist from before
    this was enforced, the ALTER fails and is logged — existing rows are
    never touched or deleted automatically.
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)"
        )
        conn.commit()
    except Exception as exc:
        logger.warning(
            "ensure_unique_user_email skipped (constraint may already exist, "
            "or duplicate emails already exist in the table): %s", exc
        )
    finally:
        if conn:
            conn.close()


def ensure_user_approval_status():
    """Judge/CourtRegistrar signups need admin approval before they can log
    in. Everyone else (Lawyer, CaseParticipant) defaults to already-approved
    so this doesn't change their existing behavior."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status "
            "VARCHAR(20) NOT NULL DEFAULT 'approved'"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_user_approval_status failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_hearing_id_sequence():
    """A real sequence for hearing ids, replacing the old MAX(hearingid)+1
    pattern which two simultaneous requests could both compute the same
    value from and collide on. Kept in sync with any manually-inserted rows
    on every startup, same as the users id sequence sync."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("CREATE SEQUENCE IF NOT EXISTS hearings_hearingid_seq")
        cur.execute(
            "SELECT setval('hearings_hearingid_seq', "
            "COALESCE((SELECT MAX(hearingid) FROM hearings), 1), "
            "(SELECT MAX(hearingid) FROM hearings) IS NOT NULL)"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_hearing_id_sequence failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_payment_verification_status():
    """A lawyer confirming a payment used to flip it straight to 'Paid' with
    no check from anyone else. Adds a 'Pending Verification' status so a
    lawyer's confirmation is a claim the registrar still has to verify."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'Pending Verification'"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_payment_verification_status failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_unique_registrar_court():
    """One court has exactly one registrar. Safe to run repeatedly — if a
    court somehow already has more than one registrar assigned, the ALTER
    fails and is logged rather than deleting/reassigning anything."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE courtregistrar ADD CONSTRAINT courtregistrar_courtid_key UNIQUE (courtid)"
        )
        conn.commit()
    except Exception as exc:
        logger.warning(
            "ensure_unique_registrar_court skipped (constraint may already "
            "exist, or a court already has more than one registrar): %s", exc
        )
    finally:
        if conn:
            conn.close()


def ensure_prosecutor_court():
    """Prosecutors belong to one court, same model as judges/registrars —
    previously they had no court affiliation at all, so every registrar saw
    every prosecutor in the system. Existing rows (created before this
    existed) are left with a NULL courtid rather than guessed at; an Admin
    or registrar can reassign them explicitly if needed."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE prosecutor ADD COLUMN IF NOT EXISTS courtid BIGINT "
            "REFERENCES court(courtid) ON DELETE SET NULL"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_prosecutor_court failed: %s", exc)
    finally:
        if conn:
            conn.close()


def fix_fk_ondelete_rules():
    """Three FK ON DELETE rules were wrong relative to their sibling
    columns on the same table, each a real data-loss/crash risk:
    - payments.courtid was CASCADE (deleting a court hard-deleted every
      payment ever recorded against it) while payments.caseid/lawyerid on
      the same table are already SET NULL — made consistent.
    - prosecutorassign.caseid had no ON DELETE rule at all (defaults to
      NO ACTION), so deleting a case with a prosecutor assigned raised a
      raw FK-violation 500, unlike every sibling case-join table
      (courtaccess/caselawyeraccess/judgeaccess/caseparticipantaccess),
      which all CASCADE.
    - caseparticipant.lawyerid likewise had no rule, so deleting a lawyer
      who had registered any clients raised the same raw 500 instead of
      just unlinking the client from that lawyer."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS paymentscourtfk")
        cur.execute(
            "ALTER TABLE payments ADD CONSTRAINT paymentscourtfk "
            "FOREIGN KEY (courtid) REFERENCES court(courtid) "
            "ON DELETE SET NULL ON UPDATE CASCADE"
        )
        cur.execute("ALTER TABLE prosecutorassign DROP CONSTRAINT IF EXISTS prosecutorassign_caseid_fkey")
        cur.execute(
            "ALTER TABLE prosecutorassign ADD CONSTRAINT prosecutorassign_caseid_fkey "
            "FOREIGN KEY (caseid) REFERENCES cases(caseid) ON DELETE CASCADE"
        )
        cur.execute("ALTER TABLE caseparticipant DROP CONSTRAINT IF EXISTS participantlawyerfk")
        cur.execute(
            "ALTER TABLE caseparticipant ADD CONSTRAINT participantlawyerfk "
            "FOREIGN KEY (lawyerid) REFERENCES lawyer(lawyerid) ON DELETE SET NULL"
        )
        conn.commit()
    except Exception as exc:
        logger.error("fix_fk_ondelete_rules failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_payment_mode_nullable():
    """A payment's mode (Cash/Card/Online Transfer) is chosen by whichever
    lawyer actually pays it, not guessed by the registrar who merely creates
    the payment request — so it must be settable to NULL at creation time
    and filled in later by confirm_payment()."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE payments ALTER COLUMN mode DROP NOT NULL")
        conn.commit()
    except Exception as exc:
        logger.error("ensure_payment_mode_nullable failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_unique_profile_userid():
    """One role-profile row per user account. Without this, a double-click
    (or a genuine race) on Complete Profile can create two Lawyer/Judge/
    CourtRegistrar/CaseParticipant/Admin rows for the same userid — the
    profile tables use their own surrogate id as primary key, so nothing
    was stopping that. Safe to run repeatedly; if duplicate rows already
    exist for some userid, the ALTER fails and is logged rather than
    deleting anything — those would need manual cleanup first."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        for table, constraint in [
            ("lawyer", "lawyer_userid_key"),
            ("judge", "judge_userid_key"),
            ("courtregistrar", "courtregistrar_userid_key"),
            ("caseparticipant", "caseparticipant_userid_key"),
            ("admin", "admin_userid_key"),
        ]:
            try:
                cur.execute(
                    f"ALTER TABLE {table} ADD CONSTRAINT {constraint} UNIQUE (userid)"
                )
                conn.commit()
            except Exception as exc:
                conn.rollback()
                logger.warning(
                    "ensure_unique_profile_userid: %s skipped (constraint may "
                    "already exist, or duplicate rows already exist): %s",
                    table, exc,
                )
    except Exception as exc:
        logger.error("ensure_unique_profile_userid failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_unique_courtname():
    """Court names are unique in the real world too — this also closes the
    double-click gap on Admin's Add Court, which had no duplicate check at
    all."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS court_courtname_lower_key "
            "ON court (LOWER(courtname))"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_unique_courtname failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_unique_courtroom_number():
    """A courtroom number is unique within its own court — closes the
    double-click gap on Add Court Room, which had an id-collision lock but
    no check against inserting the same room number twice."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE courtroom ADD CONSTRAINT courtroom_courtid_no_key "
            "UNIQUE (courtid, courtroomno)"
        )
        conn.commit()
    except Exception as exc:
        logger.warning(
            "ensure_unique_courtroom_number skipped (constraint may already "
            "exist, or a duplicate room number already exists): %s", exc
        )
    finally:
        if conn:
            conn.close()


def ensure_one_scheduled_hearing_per_case():
    """DB-level backstop for the one-scheduled-hearing-per-case rule.
    schedule_hearing() already checks this with a SELECT before inserting,
    but that check alone has a race window — two near-simultaneous requests
    can both pass it before either commits. A partial unique index closes
    that window at the database level regardless of timing."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS hearings_one_scheduled_per_case "
            "ON hearings (caseid) WHERE hearingstatus = 'scheduled'"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_one_scheduled_hearing_per_case failed: %s", exc)
    finally:
        if conn:
            conn.close()


def run_all():
    remove_documents_module()
    remove_appeals_module()
    remove_bail_surety_module()
    remove_remands_module()
    ensure_lawyer_case_status()
    ensure_unique_user_email()
    ensure_user_approval_status()
    ensure_hearing_id_sequence()
    ensure_payment_verification_status()
    ensure_unique_registrar_court()
    ensure_prosecutor_court()
    fix_fk_ondelete_rules()
    ensure_payment_mode_nullable()
    ensure_unique_profile_userid()
    ensure_unique_courtname()
    ensure_unique_courtroom_number()
    ensure_one_scheduled_hearing_per_case()
