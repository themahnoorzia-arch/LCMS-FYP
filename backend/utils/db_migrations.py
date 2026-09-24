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


def ensure_join_request_pending_participant():
    """A join request's chosen client shouldn't be linked to the case (via
    caseparticipantaccess) until the registrar actually approves it — doing
    it at submission time exposed the case to a client before any lawyer
    was confirmed on it. This column holds the requested client until
    approval links them for real; rejection just deletes the whole row."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE caselawyeraccess ADD COLUMN IF NOT EXISTS "
            "pending_participantid BIGINT REFERENCES caseparticipant(participantid) ON DELETE SET NULL"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_join_request_pending_participant failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_caseparticipant_side():
    """A case-specific 'side' for each client-case link, mirroring
    caselawyeraccess.side. Lets the Lawyer/Registrar portals resolve which
    client belongs to which lawyer *on this case*, instead of relying on
    caseparticipant.lawyerid — a single sticky per-person tag, set once and
    never updated, that breaks down as soon as a client is on more than one
    case or a case has lawyers on both sides.

    Column is nullable by design. Existing rows are backfilled below only
    where the side can be derived with certainty: a case with exactly one
    lawyer has an unambiguous side, and a case with multiple lawyers is only
    resolved if the participant's caseparticipant.lawyerid tag matches
    exactly one of that case's lawyers. Anything else is left NULL rather
    than guessed. Safe to run on every startup — already-backfilled rows
    are skipped, and rows left NULL stay NULL until fixed by hand."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "ALTER TABLE caseparticipantaccess ADD COLUMN IF NOT EXISTS side VARCHAR(20)"
        )
        cur.execute(
            "ALTER TABLE caseparticipantaccess DROP CONSTRAINT IF EXISTS caseparticipantaccess_side_check"
        )
        cur.execute(
            "ALTER TABLE caseparticipantaccess ADD CONSTRAINT caseparticipantaccess_side_check "
            "CHECK (side IN ('petitioner', 'respondent'))"
        )

        # Backfill only rows still missing a side.
        cur.execute(
            "SELECT caseid, participantid FROM caseparticipantaccess WHERE side IS NULL"
        )
        pending = cur.fetchall()
        for caseid, participantid in pending:
            cur.execute(
                "SELECT lawyerid, side FROM caselawyeraccess WHERE caseid = %s",
                (caseid,),
            )
            case_lawyers = cur.fetchall()
            if not case_lawyers:
                continue

            if len(case_lawyers) == 1:
                derived_side = case_lawyers[0][1]
            else:
                cur.execute(
                    "SELECT lawyerid FROM caseparticipant WHERE participantid = %s",
                    (participantid,),
                )
                tag_row = cur.fetchone()
                tag_lawyerid = tag_row[0] if tag_row else None
                matches = [l for l in case_lawyers if l[0] == tag_lawyerid]
                derived_side = matches[0][1] if len(matches) == 1 else None

            if derived_side:
                cur.execute(
                    "UPDATE caseparticipantaccess SET side = %s WHERE caseid = %s AND participantid = %s",
                    (derived_side, caseid, participantid),
                )

        conn.commit()
    except Exception as exc:
        logger.error("ensure_caseparticipant_side failed: %s", exc)
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


def ensure_hearing_status_values():
    """The live hearings.hearingstatus CHECK constraint allowed 'postponed'
    (which nothing in the app ever used) and rejected 'adjourned' (which the
    Registrar UI and backend both offer), so every Adjourn attempt failed at
    the database. Standardise on the four statuses the app actually uses:
    scheduled, completed, adjourned, cancelled. Any leftover 'postponed' row
    is mapped to 'adjourned' first (none exist today). Skipped when the
    constraint is already correct, so it doesn't re-lock the table on every
    startup."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conrelid = 'hearings'::regclass AND conname = 'hearings_hearingstatus_check'"
        )
        row = cur.fetchone()
        current = row[0] if row else ""
        if "'adjourned'" in current and "'postponed'" not in current:
            conn.commit()
            return
        cur.execute("UPDATE hearings SET hearingstatus = 'adjourned' WHERE hearingstatus = 'postponed'")
        cur.execute("ALTER TABLE hearings DROP CONSTRAINT IF EXISTS hearings_hearingstatus_check")
        cur.execute(
            "ALTER TABLE hearings ADD CONSTRAINT hearings_hearingstatus_check "
            "CHECK (hearingstatus IN ('scheduled', 'completed', 'adjourned', 'cancelled'))"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_hearing_status_values failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_hearing_survives_judge_deletion():
    """A hearing's record (date, time, venue, remarks) is part of the case's
    permanent history — it shouldn't be destroyed just because the presiding
    judge's account is later deleted. hearings.judgeid was ON DELETE CASCADE,
    which deleted the hearing itself; this changes it to SET NULL, matching
    how payments.lawyerid and caseparticipant.lawyerid already behave
    (unlink the person, keep the record). The column has to allow NULL
    first for that action to succeed at delete time."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE hearings ALTER COLUMN judgeid DROP NOT NULL")
        cur.execute("ALTER TABLE hearings DROP CONSTRAINT IF EXISTS hearings_judgeid_fkey")
        cur.execute(
            "ALTER TABLE hearings ADD CONSTRAINT hearings_judgeid_fkey "
            "FOREIGN KEY (judgeid) REFERENCES judge(judgeid) ON DELETE SET NULL"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_hearing_survives_judge_deletion failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_case_lawyer_link_survives_lawyer_deletion():
    """Same reasoning as above, for a case's lawyer-side record: which side
    (petitioner/respondent) had counsel shouldn't disappear from a closed
    case's history just because that lawyer's account is later deleted.
    caselawyeraccess.lawyerid was ON DELETE CASCADE (dropped the whole row,
    losing the side); this changes it to SET NULL so the row — and the side
    it recorded — survives with the lawyer unlinked instead."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE caselawyeraccess ALTER COLUMN lawyerid DROP NOT NULL")
        cur.execute("ALTER TABLE caselawyeraccess DROP CONSTRAINT IF EXISTS lawyeraccessfk")
        cur.execute(
            "ALTER TABLE caselawyeraccess ADD CONSTRAINT lawyeraccessfk "
            "FOREIGN KEY (lawyerid) REFERENCES lawyer(lawyerid) ON DELETE SET NULL"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_case_lawyer_link_survives_lawyer_deletion failed: %s", exc)
    finally:
        if conn:
            conn.close()


def ensure_finaldecision_id_sequence():
    """finaldecision.decisionid is a plain NOT NULL bigint with no default
    at all — add_final_decision() inserts caseid/summary/verdict/date and
    expects the database to supply decisionid, which it never could,
    guaranteeing a "null value in column decisionid violates not-null
    constraint" error on every single attempt. Giving the column a real
    sequence-backed default (same fix already applied to hearings.hearingid)
    means the existing INSERT just works, with no route-code change needed."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("CREATE SEQUENCE IF NOT EXISTS finaldecision_decisionid_seq")
        cur.execute(
            "SELECT setval('finaldecision_decisionid_seq', "
            "COALESCE((SELECT MAX(decisionid) FROM finaldecision), 1), "
            "(SELECT MAX(decisionid) FROM finaldecision) IS NOT NULL)"
        )
        cur.execute(
            "ALTER TABLE finaldecision ALTER COLUMN decisionid "
            "SET DEFAULT nextval('finaldecision_decisionid_seq')"
        )
        cur.execute(
            "ALTER SEQUENCE finaldecision_decisionid_seq "
            "OWNED BY finaldecision.decisionid"
        )
        conn.commit()
    except Exception as exc:
        logger.error("ensure_finaldecision_id_sequence failed: %s", exc)
    finally:
        if conn:
            conn.close()


def _ensure_unique_or_report(table, column, index_name):
    """Create a unique index on table.column — but never on top of data that
    already violates it. If duplicate values exist, nothing is created and
    nothing is deleted, merged or "fixed": the offending values are logged at
    ERROR level and returned, so the caller can't mistake the table for a
    protected one. Returns (protected, duplicates). The table/column/index
    names are code constants, never user input."""
    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            f"SELECT {column} FROM {table} GROUP BY {column} "
            f"HAVING COUNT(*) > 1 ORDER BY {column}"
        )
        duplicates = [row[0] for row in cur.fetchall()]
        if duplicates:
            conn.rollback()
            logger.error(
                "%s was NOT created: %s.%s already has duplicate values %s. "
                "Nothing was deleted or changed — resolve those rows by hand "
                "and restart; until then only the application-level check "
                "protects this rule.",
                index_name, table, column, duplicates,
            )
            return False, duplicates
        cur.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table} ({column})")
        conn.commit()
        return True, []
    except Exception as exc:
        logger.error("%s could not be created: %s", index_name, exc)
        return False, []
    finally:
        if conn:
            conn.close()


def ensure_one_finaldecision_per_case():
    """Our model is one case -> at most one final decision. The endpoint
    already refuses a second decision on a Closed case, but that is a
    check-then-insert: two near-simultaneous submissions can both pass it
    before either commits (and a Closed case that gets reopened would pass
    it too). A unique index on finaldecision.caseid closes that at the
    database level. It sits alongside the composite primary key
    (caseid, decisionid) — the key, the sequence and the FK are untouched."""
    protected, _ = _ensure_unique_or_report(
        "finaldecision", "caseid", "finaldecision_one_per_case"
    )
    return protected


def run_all():
    remove_documents_module()
    remove_appeals_module()
    remove_bail_surety_module()
    remove_remands_module()
    ensure_join_request_pending_participant()
    ensure_caseparticipant_side()
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
    ensure_hearing_status_values()
    ensure_hearing_survives_judge_deletion()
    ensure_case_lawyer_link_survives_lawyer_deletion()
    ensure_finaldecision_id_sequence()
    ensure_one_finaldecision_per_case()
