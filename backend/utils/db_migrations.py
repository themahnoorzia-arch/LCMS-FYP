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
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS documentcase CASCADE")
        cur.execute("DROP TABLE IF EXISTS documents CASCADE")
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.error("remove_documents_module failed: %s", exc)


def ensure_lawyer_case_status():
    """Make ordinary lawyer links approved; join requests opt into pending."""
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
        conn.close()
    except Exception as exc:
        logger.error("ensure_lawyer_case_status failed: %s", exc)


def run_all():
    remove_documents_module()
    ensure_lawyer_case_status()
