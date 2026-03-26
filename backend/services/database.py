import sqlite3
import json
import time
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "patterns.db"


def _get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS patterns (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            values_json TEXT    NOT NULL,
            dates_json  TEXT    NOT NULL,
            stats_json  TEXT    NOT NULL,
            match_count INTEGER DEFAULT 0,
            created_at  REAL    NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_pattern(name, description, values, dates, stats, match_count):
    conn = _get_conn()
    cur = conn.execute(
        """INSERT INTO patterns (name, description, values_json, dates_json,
                                 stats_json, match_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            name,
            description,
            json.dumps(values),
            json.dumps(dates),
            json.dumps(stats),
            match_count,
            time.time(),
        ),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return pid


def list_patterns():
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, description, stats_json, match_count, created_at "
        "FROM patterns ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "stats": json.loads(r["stats_json"]),
            "match_count": r["match_count"],
            "created_at": r["created_at"],
        })
    return result


def get_pattern(pid):
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM patterns WHERE id = ?", (pid,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "values": json.loads(row["values_json"]),
        "dates": json.loads(row["dates_json"]),
        "stats": json.loads(row["stats_json"]),
        "match_count": row["match_count"],
        "created_at": row["created_at"],
    }


def delete_pattern(pid):
    conn = _get_conn()
    conn.execute("DELETE FROM patterns WHERE id = ?", (pid,))
    conn.commit()
    conn.close()


# Initialiser la DB au premier import
init_db()
