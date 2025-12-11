import sqlite3
import os
from threading import Lock
from datetime import datetime
import json
import uuid

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
        # Schedules table for device automation
        conn.execute("""CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            target_id TEXT NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('on', 'off')),
            time TEXT NOT NULL,
            days TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT
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

# === SCHEDULE FUNCTIONS ===

def create_schedule(name: str, target_id: str, action: str, time: str, days: list, enabled: bool = True) -> dict:
    """Create a new schedule."""
    schedule_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    days_json = json.dumps(days)
    
    with lock:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.execute("""
                INSERT INTO schedules (id, name, target_id, action, time, days, enabled, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (schedule_id, name, target_id, action, time, days_json, 1 if enabled else 0, created_at))
            conn.commit()
    
    return {
        "id": schedule_id,
        "name": name,
        "targetId": target_id,
        "action": action,
        "time": time,
        "days": days,
        "enabled": enabled,
        "createdAt": created_at
    }

def get_all_schedules() -> list:
    """Get all schedules."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM schedules ORDER BY created_at DESC")
        rows = cur.fetchall()
        
        schedules = []
        for row in rows:
            schedules.append({
                "id": row["id"],
                "name": row["name"],
                "targetId": row["target_id"],
                "action": row["action"],
                "time": row["time"],
                "days": json.loads(row["days"]),
                "enabled": bool(row["enabled"]),
                "createdAt": row["created_at"]
            })
        return schedules

def get_schedule_by_id(schedule_id: str) -> dict | None:
    """Get a schedule by ID."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        row = cur.fetchone()
        
        if row:
            return {
                "id": row["id"],
                "name": row["name"],
                "targetId": row["target_id"],
                "action": row["action"],
                "time": row["time"],
                "days": json.loads(row["days"]),
                "enabled": bool(row["enabled"]),
                "createdAt": row["created_at"]
            }
        return None

def update_schedule(schedule_id: str, name: str = None, target_id: str = None, 
                   action: str = None, time: str = None, days: list = None, 
                   enabled: bool = None) -> dict | None:
    """Update an existing schedule."""
    with lock:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            # Get current schedule
            cur.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
            row = cur.fetchone()
            
            if not row:
                return None
            
            # Build update values
            new_name = name if name is not None else row["name"]
            new_target_id = target_id if target_id is not None else row["target_id"]
            new_action = action if action is not None else row["action"]
            new_time = time if time is not None else row["time"]
            new_days = json.dumps(days) if days is not None else row["days"]
            new_enabled = (1 if enabled else 0) if enabled is not None else row["enabled"]
            updated_at = datetime.now().isoformat()
            
            cur.execute("""
                UPDATE schedules 
                SET name = ?, target_id = ?, action = ?, time = ?, days = ?, enabled = ?, updated_at = ?
                WHERE id = ?
            """, (new_name, new_target_id, new_action, new_time, new_days, new_enabled, updated_at, schedule_id))
            conn.commit()
            
            return {
                "id": schedule_id,
                "name": new_name,
                "targetId": new_target_id,
                "action": new_action,
                "time": new_time,
                "days": json.loads(new_days) if isinstance(new_days, str) else new_days,
                "enabled": bool(new_enabled),
                "createdAt": row["created_at"],
                "updatedAt": updated_at
            }

def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule by ID."""
    with lock:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
            conn.commit()
            return cur.rowcount > 0

def get_enabled_schedules() -> list:
    """Get all enabled schedules for the scheduler."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM schedules WHERE enabled = 1")
        rows = cur.fetchall()
        
        schedules = []
        for row in rows:
            schedules.append({
                "id": row["id"],
                "name": row["name"],
                "targetId": row["target_id"],
                "action": row["action"],
                "time": row["time"],
                "days": json.loads(row["days"]),
                "enabled": bool(row["enabled"]),
                "createdAt": row["created_at"]
            })
        return schedules

init_db()