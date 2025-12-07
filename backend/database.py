import sqlite3
import os
from threading import Lock

DB_PATH = "data/power_history.db"
os.makedirs("data", exist_ok=True)
lock = Lock()

def init_db():
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS hourly_kwh (
            timestamp TEXT PRIMARY KEY,
            kwh REAL NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS training_log (
            date TEXT PRIMARY KEY,
            r2_rf REAL, r2_xgb REAL, r2_mlp REAL, r2_lr REAL,
            note TEXT
        )""")
        conn.commit()

def save_hourly_kwh(timestamp_iso: str, kwh: float):
    with lock:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.execute("INSERT OR REPLACE INTO hourly_kwh (timestamp, kwh) VALUES (?, ?)",
                        (timestamp_iso, round(kwh, 6)))
            conn.commit()

def get_all_history():
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT timestamp, kwh FROM hourly_kwh ORDER BY timestamp")
        rows = cur.fetchall()
        return {row["timestamp"]: row["kwh"] for row in rows}

def log_training_result(date_str, scores: dict, note=""):
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.execute("""INSERT OR REPLACE INTO training_log 
            (date, r2_rf, r2_xgb, r2_mlp, r2_lr, note)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (date_str, scores['rf'], scores['xgb'], scores['mlp'], scores['lr'], note))
        conn.commit()

init_db()