"""
migrate_add_assignee_ranking.py
--------------------------------
One-shot migration script.  Run ONCE to apply the two-phase assignee ranking schema changes:

  1. Add `assignee_ranking_status` column to the `sessions` table.
  2. Create the `session_assignee_map` table.

Usage (from the backend/ directory):
    python migrate_add_assignee_ranking.py

Safe to re-run — uses IF NOT EXISTS / IF EXISTS guards.
"""

import sys
import os

# Make sure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine
from app.models import schemas  # noqa: F401 – registers all models with Base
from app.database import Base

def run():
    with engine.connect() as conn:
        # ----------------------------------------------------------------
        # 1. Add assignee_ranking_status to sessions (if not already there)
        # ----------------------------------------------------------------
        try:
            conn.execute(text(
                "ALTER TABLE sessions ADD COLUMN assignee_ranking_status VARCHAR DEFAULT 'pending';"
            ))
            conn.commit()
            print("[OK] Added 'assignee_ranking_status' column to sessions table.")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("[SKIP] 'assignee_ranking_status' column already exists in sessions.")
            else:
                print(f"[WARN] Could not add column: {e}")

        # ----------------------------------------------------------------
        # 2. Create session_assignee_map table (via SQLAlchemy metadata)
        #    create_all with checkfirst=True will skip if already exists.
        # ----------------------------------------------------------------
        schemas.SessionAssigneeMap.__table__.create(bind=engine, checkfirst=True)
        print("[OK] 'session_assignee_map' table is ready.")

    print("\nMigration complete.")

if __name__ == "__main__":
    run()
