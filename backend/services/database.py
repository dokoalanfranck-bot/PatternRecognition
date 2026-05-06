import sqlite3
import json
import time
from pathlib import Path
from passlib.context import CryptContext

DB_PATH = Path(__file__).parent.parent / "patterns.db"

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _truncate_password_to_72(s: str) -> str:
    """Return a UTF-8 safe string whose encoded length <= 72 bytes.
    Bcrypt (via passlib) rejects passwords longer than 72 bytes; we
    truncate on the encoded byte length and decode with 'ignore' to
    avoid cutting a multi-byte sequence.
    """
    if s is None:
        return s
    b = s.encode("utf-8")
    if len(b) <= 72:
        return s
    return b[:72].decode("utf-8", "ignore")

def _get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            created_at    REAL    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS patterns (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            values_json TEXT    NOT NULL,
            dates_json  TEXT    NOT NULL,
            stats_json  TEXT    NOT NULL,
            match_count INTEGER DEFAULT 0,
            pattern_type TEXT    DEFAULT 'normal',
            alert_threshold REAL DEFAULT 55.0,
            alert_type  TEXT    DEFAULT 'anomaly',
            dataset     TEXT    DEFAULT '',
            created_at  REAL    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS realtime_events (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_id      INTEGER,
            pattern_name    TEXT,
            pattern_type    TEXT    DEFAULT 'normal',
            split_index     INTEGER,
            total_splits    INTEGER,
            similarity      REAL,
            confidence      TEXT    DEFAULT 'low',
            details_json    TEXT    DEFAULT '{}',
            created_at      REAL    NOT NULL
        )
    """)
    conn.commit()
    # Migration : ajouter colonnes si elles n'existent pas
    try:
        conn.execute("ALTER TABLE patterns ADD COLUMN alert_threshold REAL DEFAULT 55.0")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE patterns ADD COLUMN alert_type TEXT DEFAULT 'anomaly'")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE patterns ADD COLUMN dataset TEXT DEFAULT ''")
    except Exception:
        pass
    _ensure_default_user(conn)
    conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTHENTIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def _ensure_default_user(conn):
    """Crée le compte admin par défaut s'il n'existe pas."""
    exists = conn.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
    if not exists:
        conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            ("admin", _pwd_context.hash(_truncate_password_to_72("admin")), time.time()),
        )
        conn.commit()


def get_user(username: str):
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row["id"], "username": row["username"], "password_hash": row["password_hash"]}


def verify_password(plain: str, hashed: str) -> bool:
    if plain is None:
        return False
    return _pwd_context.verify(_truncate_password_to_72(plain), hashed)


def set_password(username: str, new_password: str):
    conn = _get_conn()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE username = ?",
        (_pwd_context.hash(_truncate_password_to_72(new_password)), username),
    )
    conn.commit()
    conn.close()


def save_pattern(name, description, values, dates, stats, match_count, pattern_type="normal",
                  alert_threshold=55.0, alert_type="anomaly", dataset=""):
    conn = _get_conn()
    cur = conn.execute(
        """INSERT INTO patterns (name, description, values_json, dates_json,
                                 stats_json, match_count, pattern_type, alert_threshold,
                                 alert_type, dataset, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            name,
            description,
            json.dumps(values),
            json.dumps(dates),
            json.dumps(stats),
            match_count,
            pattern_type,
            alert_threshold,
            alert_type,
            dataset or "",
            time.time(),
        ),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return pid


def list_patterns(dataset=None):
    conn = _get_conn()
    if dataset:
        rows = conn.execute(
            "SELECT id, name, description, stats_json, match_count, pattern_type, "
            "alert_threshold, alert_type, dataset, created_at "
            "FROM patterns WHERE dataset = ? ORDER BY created_at DESC",
            (dataset,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, name, description, stats_json, match_count, pattern_type, "
            "alert_threshold, alert_type, dataset, created_at "
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
            "pattern_type": r["pattern_type"] or "normal",
            "alert_threshold": r["alert_threshold"] if r["alert_threshold"] else 55.0,
            "alert_type": r["alert_type"] or "anomaly",
            "dataset": r["dataset"] or "",
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
        "pattern_type": row["pattern_type"] or "normal",
        "match_count": row["match_count"],
        "alert_threshold": row["alert_threshold"] if row["alert_threshold"] else 55.0,
        "alert_type": row["alert_type"] or "anomaly",
        "dataset": row["dataset"] if "dataset" in row.keys() else "",
        "created_at": row["created_at"],
    }


def update_pattern_type(pid, pattern_type):
    """Mettre à jour le type d'un pattern (normal ou failure)"""
    if pattern_type not in ("normal", "failure"):
        pattern_type = "normal"
    conn = _get_conn()
    conn.execute("UPDATE patterns SET pattern_type = ? WHERE id = ?", (pattern_type, pid))
    conn.commit()
    conn.close()


def update_pattern_threshold(pid, alert_threshold=None, alert_type=None):
    """Mettre à jour le seuil et/ou le type d'alerte d'un pattern."""
    conn = _get_conn()
    if alert_threshold is not None and alert_type is not None:
        conn.execute("UPDATE patterns SET alert_threshold = ?, alert_type = ? WHERE id = ?",
                     (alert_threshold, alert_type, pid))
    elif alert_threshold is not None:
        conn.execute("UPDATE patterns SET alert_threshold = ? WHERE id = ?", (alert_threshold, pid))
    elif alert_type is not None:
        conn.execute("UPDATE patterns SET alert_type = ? WHERE id = ?", (alert_type, pid))
    conn.commit()
    conn.close()


def delete_pattern(pid):
    conn = _get_conn()
    conn.execute("DELETE FROM patterns WHERE id = ?", (pid,))
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  REALTIME EVENTS
# ═══════════════════════════════════════════════════════════════════════════════

def save_realtime_event(pattern_id, pattern_name, pattern_type, split_index,
                        total_splits, similarity, confidence, details=None):
    conn = _get_conn()
    cur = conn.execute(
        """INSERT INTO realtime_events
           (pattern_id, pattern_name, pattern_type, split_index, total_splits,
            similarity, confidence, details_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            pattern_id, pattern_name, pattern_type, split_index, total_splits,
            similarity, confidence, json.dumps(details or {}), time.time(),
        ),
    )
    conn.commit()
    eid = cur.lastrowid
    conn.close()
    return eid


def list_realtime_events(limit=100):
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM realtime_events ORDER BY created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "pattern_id": r["pattern_id"],
            "pattern_name": r["pattern_name"],
            "pattern_type": r["pattern_type"],
            "split_index": r["split_index"],
            "total_splits": r["total_splits"],
            "similarity": r["similarity"],
            "confidence": r["confidence"],
            "details": json.loads(r["details_json"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def clear_realtime_events():
    conn = _get_conn()
    conn.execute("DELETE FROM realtime_events")
    conn.commit()
    conn.close()


# Initialiser la DB au premier import
init_db()
