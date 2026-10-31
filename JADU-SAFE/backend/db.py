import json
import sqlite3
from contextlib import contextmanager

from config import (
    DB_BACKEND, DB_PATH, MYSQL_DATABASE, MYSQL_HOST, MYSQL_PASSWORD,
    MYSQL_PORT, MYSQL_USER,
)

if DB_BACKEND not in {"sqlite", "mysql"}:
    raise RuntimeError("JADU_DB_BACKEND must be either 'sqlite' or 'mysql'")

if DB_BACKEND == "mysql":
    try:
        import mysql.connector
    except ImportError as exc:
        raise RuntimeError(
            "MySQL backend selected but mysql-connector-python is not installed"
        ) from exc


@contextmanager
def conn():
    if DB_BACKEND == "mysql":
        c = mysql.connector.connect(
            host=MYSQL_HOST, port=MYSQL_PORT, database=MYSQL_DATABASE,
            user=MYSQL_USER, password=MYSQL_PASSWORD,
        )
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()
        return

    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def _cursor(c, dictionary=False):
    return c.cursor(dictionary=dictionary) if DB_BACKEND == "mysql" else c.cursor()


def _placeholder():
    return "%s" if DB_BACKEND == "mysql" else "?"


def init_db():
    with conn() as c:
        if DB_BACKEND == "mysql":
            cur = _cursor(c)
            cur.execute("""CREATE TABLE IF NOT EXISTS readings(
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                station_id VARCHAR(100) NOT NULL, received_at VARCHAR(40) NOT NULL,
                device_ts VARCHAR(40), status VARCHAR(20), risk_score INT,
                payload JSON NOT NULL,
                INDEX idx_readings_station (station_id, id))""")
            cur.execute("""CREATE TABLE IF NOT EXISTS alerts(
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                alert_id VARCHAR(30) UNIQUE, station_id VARCHAR(100),
                parameter VARCHAR(80), value DOUBLE, severity VARCHAR(20),
                message TEXT, timestamp VARCHAR(40), acknowledged BOOLEAN DEFAULT FALSE)""")
            cur.close()
            return

        c.execute("""CREATE TABLE IF NOT EXISTS readings(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL, received_at TEXT NOT NULL, device_ts TEXT,
            status TEXT, risk_score INTEGER, payload TEXT NOT NULL)""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_readings_station ON readings(station_id, id)")
        c.execute("""CREATE TABLE IF NOT EXISTS alerts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id TEXT UNIQUE, station_id TEXT, parameter TEXT, value REAL,
            severity TEXT, message TEXT, timestamp TEXT, acknowledged INTEGER DEFAULT 0)""")


def insert_reading(record: dict):
    with conn() as c:
        p = _placeholder()
        cur = _cursor(c)
        cur.execute(
            f"INSERT INTO readings(station_id,received_at,device_ts,status,risk_score,payload) VALUES({p},{p},{p},{p},{p},{p})",
            (record["station_id"], record["received_at"], record.get("timestamp"),
             record["status"], record["risk_score"], json.dumps(record)),
        )
        if DB_BACKEND == "mysql":
            cur.close()


def recent_readings(station_id: str, limit: int):
    with conn() as c:
        p = _placeholder()
        cur = _cursor(c, dictionary=DB_BACKEND == "mysql")
        cur.execute(f"SELECT payload FROM readings WHERE station_id={p} ORDER BY id DESC LIMIT {p}",
                    (station_id, limit))
        rows = cur.fetchall()
        if DB_BACKEND == "mysql":
            cur.close()
    return [json.loads(r["payload"] if isinstance(r, dict) else r[0]) for r in reversed(rows)]


def latest_reading(station_id: str):
    rows = recent_readings(station_id, 1)
    return rows[0] if rows else None


def active_alert_exists(station_id: str, parameter: str, severity: str) -> bool:
    with conn() as c:
        p = _placeholder()
        cur = _cursor(c)
        cur.execute(
            f"SELECT 1 FROM alerts WHERE station_id={p} AND parameter={p} AND severity={p} AND acknowledged=0 LIMIT 1",
            (station_id, parameter, severity),
        )
        row = cur.fetchone()
        if DB_BACKEND == "mysql":
            cur.close()
    return row is not None


def insert_alert(station_id, parameter, value, severity, message, timestamp):
    with conn() as c:
        p = _placeholder()
        cur = _cursor(c)
        cur.execute(
            f"INSERT INTO alerts(station_id,parameter,value,severity,message,timestamp) VALUES({p},{p},{p},{p},{p},{p})",
            (station_id, parameter, value, severity, message, timestamp),
        )
        alert_id = f"ALT-{cur.lastrowid:05d}"
        cur.execute(f"UPDATE alerts SET alert_id={p} WHERE id={p}", (alert_id, cur.lastrowid))
        if DB_BACKEND == "mysql":
            cur.close()
    return alert_id


def list_alerts(severity=None, acknowledged=None, station_id=None, limit=100):
    p = _placeholder()
    q, args = "SELECT * FROM alerts WHERE 1=1", []
    if severity:
        q += f" AND severity={p}"; args.append(severity)
    if acknowledged is not None:
        q += f" AND acknowledged={p}"; args.append(1 if acknowledged else 0)
    if station_id:
        q += f" AND station_id={p}"; args.append(station_id)
    q += f" ORDER BY id DESC LIMIT {p}"; args.append(limit)
    with conn() as c:
        cur = _cursor(c, dictionary=DB_BACKEND == "mysql")
        cur.execute(q, args)
        rows = cur.fetchall()
        if DB_BACKEND == "mysql":
            cur.close()
    out = []
    for row in rows:
        item = dict(row) if isinstance(row, dict) else dict(row)
        item["acknowledged"] = bool(item["acknowledged"])
        out.append(item)
    return out


def acknowledge(alert_id: str) -> bool:
    with conn() as c:
        p = _placeholder()
        cur = _cursor(c)
        cur.execute(f"UPDATE alerts SET acknowledged=1 WHERE alert_id={p}", (alert_id,))
        changed = cur.rowcount > 0
        if DB_BACKEND == "mysql":
            cur.close()
    return changed


def count_active_alerts_by_station():
    with conn() as c:
        cur = _cursor(c, dictionary=DB_BACKEND == "mysql")
        cur.execute("SELECT station_id, COUNT(*) n FROM alerts WHERE acknowledged=0 GROUP BY station_id")
        rows = cur.fetchall()
        if DB_BACKEND == "mysql":
            cur.close()
    return {
        (r["station_id"] if isinstance(r, dict) else r[0]):
        (r["n"] if isinstance(r, dict) else r[1])
        for r in rows
    }
