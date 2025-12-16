from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import requests
import websocket
import json
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import time
import threading
import random
import hashlib
from collections import defaultdict

# === Database Integration ===
from database import (
    create_schedule, 
    get_all_schedules, 
    get_schedule_by_id,
    update_schedule, 
    delete_schedule, 
    get_enabled_schedules
)

# === Forecast Integration ===
try:
    from websocket_forecast import forecast_client
    from database import save_hourly_kwh
    FORECAST_ENABLED = True
except ImportError:
    print("WARNING: websocket_forecast.py not found. Running without forecast.")
    FORECAST_ENABLED = False

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
# Load environment variables
load_dotenv()

# Core IoT Info
CORE_IOT_URL = "https://app.coreiot.io"
JWT_TOKEN = os.getenv("JWT_TOKEN")
DEVICE_ID = os.getenv("DEVICE_ID")
GROUP_ID = os.getenv("GROUP_ID")
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}"}

# Check environment variables
if not all([JWT_TOKEN, DEVICE_ID, GROUP_ID]):
    raise ValueError("JWT_TOKEN, DEVICE_ID and GROUP_ID must be set in .env file")

# Logs directory
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# Logging config
logging.basicConfig(
    filename=os.path.join(log_dir, 'telemetry.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Telemetry keys
TELEMETRY_KEYS = ["ENERGY-Voltage", "ENERGY-Current", "ENERGY-Power", "ENERGY-Today",
                  "ENERGY-Total", "ENERGY-Factor"]

# Device types and locations for display
DEVICE_TYPES = ["light", "fan", "ac", "sensor", "camera"]
DEVICE_LOCATIONS = ["Phòng khách", "Phòng ngủ", "Phòng làm việc", "Phòng ăn", "Ban công"]
DEVICE_NAME_MAP = {
    "light": "Đèn thông minh",
    "fan": "Quạt máy",
    "ac": "Điều hòa",
    "sensor": "Cảm biến",
    "camera": "Camera"
}

# Store latest data
latest_data = {}
subscription_to_device_map = {}

# Cache metadata đã gán
DEVICE_METADATA_CACHE = {}

# Store alert thresholds for each client
client_thresholds = {}

# === GLOBAL VARIABLES FOR FORECAST ===
if FORECAST_ENABLED:
    previous_energy = {}
    hourly_kwh_global = {}
    predicted_details_cache = {}
    lock = threading.Lock()

    def process_new_energy(device_id, total_energy_str, ts_iso):
        """Calculate hourly kWh from ENERGY-Total and save to DB"""
        global hourly_kwh_global, previous_energy
        try:
            total_energy = float(total_energy_str)
            ts = datetime.fromisoformat(ts_iso.replace("Z", "+00:00")).replace(tzinfo=None)
        except:
            return

        with lock:
            key = ts.strftime("%Y-%m-%dT%H:00:00")
            prev = previous_energy.get(device_id)

            if prev:
                prev_ts, prev_val = prev
                if prev_ts.hour != ts.hour or prev_ts.date() != ts.date():
                    delta = total_energy - prev_val
                    if delta < 0:  # reset today
                        delta = total_energy

                    hourly_kwh_global[key] = hourly_kwh_global.get(key, 0.0) + round(delta, 4)
                    save_hourly_kwh(key, hourly_kwh_global[key])

                    # Feedback logic
                    if key in predicted_details_cache:
                        forecast_client.send_feedback(
                            {key: predicted_details_cache[key]},
                            {key: hourly_kwh_global[key]}
                        )
                        del predicted_details_cache[key]

            previous_energy[device_id] = (ts, total_energy)

    def generate_realistic_kwh(hour):
        """Generate realistic kWh based on time of day."""
        if 0 <= hour < 6:
            base = 0.1  # Night: Low
        elif 6 <= hour < 9:
            base = 0.9   # Morning: High
        elif 9 <= hour < 17:
            base = 0.35  # Day: Medium
        elif 17 <= hour < 22:
            base = 1.5   # Evening: Peak
        else:
            base = 0.6   # Late Night: Medium

        noise_factor = random.uniform(0.8, 1.2)
        return round(base * noise_factor, 4)

    def init_dummy_data():
        """Run ONCE at startup to populate data (For testing)"""
        logging.info("!!! SYSTEM STARTUP: Generating REALISTIC dummy data...")
        with lock:
            dummy_now = datetime.now()
            for i in range(750):
                past_time = dummy_now - timedelta(hours=i)
                key = past_time.strftime("%Y-%m-%dT%H:00:00")
                if key not in hourly_kwh_global:
                    hourly_kwh_global[key] = generate_realistic_kwh(past_time.hour)
        logging.info("!!! Data generation complete. Waiting for manual trigger (/forecast).")

# --- Core IoT Functions ---

def get_or_assign_metadata(device_id):
    """
    Hàm trung tâm để gán Type, Location, Name cho thiết bị.
    Chỉ tính toán 1 lần duy nhất cho mỗi ID.
    Gán Metadata cố định dựa trên Device ID để không bị đổi tên khi restart server.
    """
    global DEVICE_METADATA_CACHE, DEVICE_TYPES, DEVICE_LOCATIONS, DEVICE_NAME_MAP
    
    if device_id in DEVICE_METADATA_CACHE:
        return DEVICE_METADATA_CACHE[device_id]
        
    # Sử dụng Hash của device_id để ra một số nguyên cố định
    hash_object = hashlib.md5(device_id.encode())
    hash_int = int(hash_object.hexdigest(), 16)
    
    # Dùng số hash này để chia lấy dư -> Luôn ra cùng 1 kết quả cho 1 device_id
    type_idx = hash_int % len(DEVICE_TYPES)
    loc_idx = hash_int % len(DEVICE_LOCATIONS)
    
    device_type = DEVICE_TYPES[type_idx]
    device_location = DEVICE_LOCATIONS[loc_idx]
    device_name = f"{DEVICE_NAME_MAP.get(device_type, device_type)}"

    metadata = {
        "type": device_type,
        "name": device_name,
        "location": device_location
    }
    DEVICE_METADATA_CACHE[device_id] = metadata
    logging.info(f"Device Metadata Assigned: {device_id} -> {device_name}")
    
    return metadata

def verify_token():
    """Verify JWT token validity."""
    try:
        response = requests.get(
            f"{CORE_IOT_URL}/api/auth/user",
            headers=HEADERS,
            timeout=10
        )
        response.raise_for_status()
        logging.info("JWT_TOKEN is valid")
        return True
    except requests.RequestException as e:
        logging.error(f"Invalid JWT_TOKEN: {e}, Status Code: {getattr(e.response, 'status_code', 'N/A')}")
        return False

def get_devices_from_group():
    """Get all devices from group with fallback."""
    try:
        url = f"{CORE_IOT_URL}/api/tenant/devices?pageSize=100&page=0&groupId={GROUP_ID}"
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        devices_data = response.json().get("data", [])
        
        if not isinstance(devices_data, list):
            logging.warning(f"Expected list from /api/tenant/devices but got {type(devices_data)}. Fallback.")
            raise requests.RequestException("Invalid data format from group API")
            
        device_ids = [device["id"]["id"] for device in devices_data]
        
        if not device_ids:
            logging.warning(f"No devices found in group {GROUP_ID}. Checking fallback.")
            raise requests.RequestException("No devices in group")

        logging.info(f"Found {len(device_ids)} devices in group {GROUP_ID}")
        return device_ids
    
    except requests.RequestException as e:
        logging.error(f"Error fetching devices from group {GROUP_ID}: {e}")
        
        # Fallback: Get all tenant devices
        try:
            response = requests.get(
                f"{CORE_IOT_URL}/api/tenant/devices?pageSize=100&page=0",
                headers=HEADERS, timeout=15
            )
            response.raise_for_status()
            devices = response.json()["data"]
            device_ids = [device["id"]["id"] for device in devices]
            logging.info(f"Fallback: Found {len(device_ids)} devices in tenant")
            return device_ids
        except requests.RequestException as e_fallback:
            logging.error(f"Error fetching tenant devices (fallback): {e_fallback}")
            logging.warning(f"Fallback: Using default DEVICE_ID {DEVICE_ID}")
            return [DEVICE_ID]

def get_device_telemetry(device_id):
    """Fetch device telemetry data."""
    try:
        response = requests.get(
            f"{CORE_IOT_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries?keys={','.join(TELEMETRY_KEYS)}&limit=1",
            headers=HEADERS,
            timeout=15
        )
        response.raise_for_status()
        telemetry = response.json()
        
        if device_id not in latest_data:
            metadata = get_or_assign_metadata(device_id)
            latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}, "metadata": metadata}
        
        parsed_telemetry = {}
        for key, value_list in telemetry.items():
            if value_list and isinstance(value_list, list) and value_list[0] and 'value' in value_list[0]:
                parsed_telemetry[key] = value_list[0]['value']
            else:
                parsed_telemetry[key] = "N/A"
        
        latest_data[device_id]["telemetry"].update(parsed_telemetry)
        logging.info(f"Telemetry received for device {device_id}: {parsed_telemetry}")
        return telemetry
        
    except requests.RequestException as e:
        logging.error(f"Error fetching telemetry for device {device_id}: {e}")
        return {}
    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON telemetry for device {device_id}")
        return {}

def get_device_attributes(device_id):
    """Fetch device attributes (POWER state)."""
    try:
        response = requests.get(
            f"{CORE_IOT_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/attributes/CLIENT_SCOPE",
            headers=HEADERS,
            timeout=15
        )
        response.raise_for_status()
        attributes = response.json()
        power_attr = next((attr for attr in attributes if attr["key"] == "POWER"), {"value": "N/A"})
        
        if device_id not in latest_data:
            metadata = get_or_assign_metadata(device_id)
            latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}, "metadata": metadata}
            
        latest_data[device_id]["attributes"]["POWER"] = power_attr["value"]
        logging.info(f"POWER attribute received for device {device_id}: {power_attr['value']}")
        return attributes
    except requests.RequestException as e:
        logging.error(f"Error fetching attributes for device {device_id}: {e}")
        return []
    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON attributes for device {device_id}")
        return []

def send_rpc_to_device(device_id, command, retries=3):
    """Send RPC command (POWER: ON/OFF) to device with retry logic."""
    api_url = f"{CORE_IOT_URL}/api/rpc/oneway/{device_id}"
    payload = {
        "method": "POWER",
        "params": command.upper()
    }
    
    for attempt in range(retries):
        try:
            response = requests.post(api_url, headers=HEADERS, json=payload, timeout=15)
            
            if response.status_code == 200:
                logging.info(f"RPC '{command}' sent to {device_id} successfully.")
                return True, {"status": "success", "device_id": device_id, "command_sent": command}
            elif response.status_code == 401:
                logging.warning(f"401 error sending RPC to {device_id}: Invalid token.")
                return False, {"status": "error", "message": "Token (JWT) expired or invalid."}
            else:
                logging.error(f"Error sending RPC to {device_id}: {response.status_code} - {response.text}")
                return False, {"status": "error", "message": response.text, "device_id": device_id}
                
        except requests.exceptions.Timeout as e:
            logging.warning(f"Timeout attempt {attempt + 1}/{retries} sending RPC to {device_id}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                logging.error(f"All {retries} attempts failed sending RPC to {device_id}")
                return False, {"status": "error", "message": "Device not responding. Please check connection.", "device_id": device_id}
        except requests.exceptions.RequestException as e:
            logging.error(f"Connection error sending RPC to {device_id}: {e}")
            return False, {"status": "error", "message": str(e), "device_id": device_id}

# --- Background Threads ---

def periodic_data_logger():
    """Periodically fetch data every 10s."""
    while True:
        logging.info("Periodic check: Starting data fetch cycle")
        if verify_token():
            devices = get_devices_from_group()
            for device_id in devices:
                get_device_telemetry(device_id)
                get_device_attributes(device_id)
                time.sleep(0.1)
        else:
            logging.warning("Periodic check: Cannot fetch data due to invalid token")
        time.sleep(10)

# Map day abbreviations to weekday numbers (Monday = 0)
DAY_MAP = {
    'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 
    'Fri': 4, 'Sat': 5, 'Sun': 6
}

def schedule_executor():
    """Background thread to execute scheduled actions."""
    logging.info("Schedule executor started")
    executed_today = {}  # Track executed schedules to avoid duplicates
    
    while True:
        try:
            now = datetime.now()
            current_time = now.strftime('%H:%M')
            current_day = list(DAY_MAP.keys())[now.weekday()]  # Get day abbreviation
            today_key = now.strftime('%Y-%m-%d')
            
            # Clean up old entries from executed_today (reset daily)
            keys_to_remove = [k for k in executed_today.keys() if not k.startswith(today_key)]
            for k in keys_to_remove:
                del executed_today[k]
            
            # Get all enabled schedules
            schedules = get_enabled_schedules()
            
            for schedule in schedules:
                schedule_key = f"{today_key}_{schedule['id']}_{schedule['time']}"
                
                # Check if this schedule should run now
                if (schedule['time'] == current_time and 
                    current_day in schedule['days'] and 
                    schedule_key not in executed_today):
                    
                    logging.info(f"Executing schedule: {schedule['name']} - {schedule['action'].upper()} for {schedule['targetId']}")
                    
                    # Execute the scheduled action
                    target_id = schedule['targetId']
                    action = schedule['action'].upper()
                    
                    # Check if target is a device or all devices in group
                    if target_id == 'all' or target_id == 'group':
                        # Control all devices in group
                        device_ids = get_devices_from_group()
                        for device_id in device_ids:
                            success, result = send_rpc_to_device(device_id, action)
                            if success:
                                logging.info(f"Schedule executed: {schedule['name']} -> {device_id} {action}")
                            else:
                                logging.error(f"Schedule failed for {device_id}: {result}")
                            time.sleep(0.1)
                    else:
                        # Control single device
                        success, result = send_rpc_to_device(target_id, action)
                        if success:
                            logging.info(f"Schedule executed: {schedule['name']} -> {target_id} {action}")
                        else:
                            logging.error(f"Schedule failed for {target_id}: {result}")
                    
                    # Mark as executed
                    executed_today[schedule_key] = True
                    
                    # Emit execution event to connected clients
                    socketio.emit('schedule_executed', {
                        'scheduleId': schedule['id'],
                        'scheduleName': schedule['name'],
                        'targetId': target_id,
                        'action': action,
                        'executedAt': now.isoformat()
                    }, room='schedules')
                    
                    # Also emit as activity log
                    log_entry = {
                        'id': f'log-{int(time.time() * 1000)}',
                        'action': f'Lịch trình tự động: {schedule["name"]}',
                        'deviceId': target_id,
                        'deviceName': schedule['name'],
                        'user': 'Scheduler',
                        'timestamp': now.isoformat(),
                        'details': f'{action} - {schedule["time"]}'
                    }
                    socketio.emit('activity_log', log_entry, room='logs')
            
        except Exception as e:
            logging.error(f"Schedule executor error: {e}")
        
        # Check every 30 seconds
        time.sleep(30)

def start_websocket():
    """Start WebSocket connection for real-time updates."""
    ws_url = f"wss://app.coreiot.io/api/ws/plugins/telemetry?token={JWT_TOKEN}"
    
    def on_message(ws, message):
        global latest_data, subscription_to_device_map
        try:
            data = json.loads(message)
            subscription_id = data.get("subscriptionId")
            device_id = subscription_to_device_map.get(subscription_id)
            
            if not device_id:
                if "errorCode" in data and data["errorCode"] != 0:
                    logging.error(f"WebSocket server error: {data.get('errorMsg', 'Unknown')}")
                return

            if "data" in data:
                telemetry_data = data.get("data", {})
                
                if device_id not in latest_data:
                    metadata = get_or_assign_metadata(device_id)
                    latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}, "metadata": metadata}

                # Process Telemetry
                telemetry_keys_found = {key: telemetry_data[key][0][1] for key in TELEMETRY_KEYS if key in telemetry_data}
                if telemetry_keys_found:
                    latest_data[device_id]["telemetry"].update(telemetry_keys_found)
                    logging.info(f"Real-time telemetry for {device_id}: {telemetry_keys_found}")
                    
                    # Emit update via Socket.IO
                    # socketio.emit('device_update', {
                    #     'device_id': device_id,
                    #     'telemetry': latest_data[device_id]["telemetry"],
                    #     'attributes': latest_data[device_id]["attributes"]
                    # }, room='device_updates')

                    # === ALERT LOGIC: Check threshold và auto-shutdown ===
                    if "ENERGY-Current" in telemetry_keys_found:
                        current_val = float(telemetry_keys_found["ENERGY-Current"])
                        display_name = latest_data[device_id]["metadata"]["name"]

                        # Duyệt qua từng client đang kết nối để xem ai cần cảnh báo
                        for sid, threshold in client_thresholds.items():
                            if current_val > threshold:
                                msg = {
                                    "level": "DANGER",
                                    "device_id": device_id,
                                    "current": current_val,
                                    "threshold": threshold,
                                    "message": f"{display_name} (Dòng {current_val}A) vượt ngưỡng {threshold}A."
                                }
                                # Gửi đích danh cho Client đó
                                socketio.emit('alert_trigger', msg, room=sid)
                                
                                # Tự động tắt thiết bị khi vượt ngưỡng
                                try:
                                    logging.warning(f"Auto-shutdown: {display_name} (Current: {current_val}A > Threshold: {threshold}A)")
                                    success, result = send_rpc_to_device(device_id, "OFF")
                                    if success:
                                        logging.info(f"Auto-shutdown successful for {device_id}")
                                    else:
                                        logging.error(f"Auto-shutdown failed for {device_id}: {result}")
                                except Exception as e:
                                    logging.error(f"Error during auto-shutdown for {device_id}: {e}")
                                
                                # Chỉ tắt một lần, thoát vòng lặp
                                break

                # Process Attribute (POWER)
                if "POWER" in telemetry_data:
                    power_val = telemetry_data["POWER"][0][1]
                    old_power = latest_data[device_id]["attributes"].get("POWER", "N/A")
                    latest_data[device_id]["attributes"]["POWER"] = power_val
                    logging.info(f"Real-time attribute for {device_id}: POWER = {power_val}")
                    
                    # Emit update via Socket.IO
                    # socketio.emit('device_update', {
                    #     'device_id': device_id,
                    #     'telemetry': latest_data[device_id]["telemetry"],
                    #     'attributes': latest_data[device_id]["attributes"]
                    # }, room='device_updates')

                    # Nếu có thay đổi trạng thái POWER, gửi log về FE
                    if old_power != "N/A" and old_power != power_val:
                        display_name = latest_data[device_id]["metadata"]["name"]
                        action = "Bật thiết bị" if power_val == "ON" else "Tắt thiết bị"
                        
                        log_entry = {
                            'id': f'log-{int(time.time() * 1000)}',
                            'action': action,
                            'deviceId': device_id,
                            'deviceName': display_name,
                            'user': 'Hệ thống',
                            'timestamp': datetime.now().isoformat(),
                            'details': f'Trạng thái: {power_val}'
                        }
                        
                        # Broadcast log đến tất cả clients
                        socketio.emit('activity_log', log_entry, room='logs')
                        logging.info(f"Activity log sent: {action} - {display_name}")

                # Process ENERGY-Total for forecast
                if FORECAST_ENABLED and "ENERGY-Total" in telemetry_data:
                    ts_ms = telemetry_data["ENERGY-Total"][0][0]
                    iso_ts = datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%dT%H:%M:%SZ")
                    process_new_energy(device_id, telemetry_data["ENERGY-Total"][0][1], iso_ts)
                
                # Broadcast Data to dashboard
                socketio.emit('dashboard_update', {
                    "device_id": device_id,
                    "data": latest_data[device_id],
                    "timestamp": datetime.now().isoformat()
                }, room='dashboard')
            
        except json.JSONDecodeError as e:
            logging.error(f"Error decoding WebSocket message: {e}")
        except Exception as e:
            logging.error(f"Error processing WebSocket message: {e}")
    
    def on_error(ws, error):
        logging.error(f"WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        logging.warning(f"WebSocket closed: Status {close_status_code}, Message: {close_msg}")
    
    def on_open(ws):
        logging.info("WebSocket connection opened, subscribing to devices...")
        global subscription_to_device_map
        subscription_to_device_map.clear()
        
        try:
            device_ids = get_devices_from_group()
            if not device_ids:
                logging.error("WebSocket: Could not get device list.")
                return

            ts_sub_cmds = []
            attr_sub_cmds = []
            cmd_id_counter = 1

            for dev_id in device_ids:
                # Subscribe to Telemetry
                ts_sub_cmds.append({
                    "entityType": "DEVICE",
                    "entityId": dev_id,
                    "scope": "LATEST_TELEMETRY",
                    "keys": ",".join(TELEMETRY_KEYS),
                    "cmdId": cmd_id_counter
                })
                subscription_to_device_map[cmd_id_counter] = dev_id
                cmd_id_counter += 1
                
                # Subscribe to Attribute (POWER)
                attr_sub_cmds.append({
                    "entityType": "DEVICE",
                    "entityId": dev_id,
                    "scope": "CLIENT_SCOPE",
                    "keys": "POWER",
                    "cmdId": cmd_id_counter
                })
                subscription_to_device_map[cmd_id_counter] = dev_id
                cmd_id_counter += 1

            subscription_message = {
                "tsSubCmds": ts_sub_cmds,
                "attrSubCmds": attr_sub_cmds
            }
            ws.send(json.dumps(subscription_message))
            logging.info(f"WebSocket: Subscribed to {len(device_ids)} devices.")

        except Exception as e:
            logging.error(f"Error during WebSocket subscription: {e}")
    
    # Reconnection loop
    while True:
        if verify_token():
            try:
                ws = websocket.WebSocketApp(ws_url, on_message=on_message, on_error=on_error, 
                                           on_open=on_open, on_close=on_close)
                ws.run_forever(ping_interval=30, ping_timeout=10)
            except Exception as e:
                logging.error(f"WebSocket connection failed: {e}")
        else:
            logging.error("Cannot start WebSocket due to invalid token")
        
        logging.info("WebSocket connection closed. Retrying in 30 seconds...")
        time.sleep(30)

# === FLASK ROUTES (API) ===

@app.route('/', methods=['GET'])
def home():
    endpoints = {
        "/check-data": "Get all device data",
        "/check-token": "Verify JWT token",
        "/control/<device_id>/<on|off>": "Control specific device",
        "/control/group/<on|off>": "Control all devices"
    }
    
    if FORECAST_ENABLED:
        endpoints["/forecast"] = "Trigger AI forecast"
        endpoints["/forecast/summary"] = "Get simplified forecast result (Fast)"
        endpoints["/energy"] = "Get hourly kWh data"
    
    return jsonify({
        "status": "success",
        "message": "Smart Plug Backend - Full Features (Alert + Forecast)",
        "features": {
            "forecast": FORECAST_ENABLED,
            "auto_shutdown": True,
            "activity_logs": True,
            "realtime_alerts": True
        },
        "endpoints": endpoints
    })

@app.route('/check-data', methods=['GET'])
def check_data():
    """API to check data (returns all devices in group)."""
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401
    
    if not latest_data:
        logging.warning("/check-data called but no data cached yet. Forcing fetch.")
        devices = get_devices_from_group()
        for device_id in devices:
            get_device_telemetry(device_id)
            get_device_attributes(device_id)
            
    data_array = []
    for device_id, info in latest_data.items():
        meta = info.get("metadata", {"type": "unknown", "name": "Unknown", "location": "N/A"})
        
        data_array.append({
            "type": meta["type"],
            "name": meta["name"],
            "location": meta["location"],
            "id": device_id,
            "attributes": info.get("attributes", {}),
            "telemetry": info.get("telemetry", {})
        })

    logging.info(f"API response for /check-data: {len(data_array)} devices")
    return jsonify({"status": "success", "data": data_array})

@app.route('/check-token', methods=['GET'])
def check_token():
    """API to verify token."""
    if verify_token():
        return jsonify({"status": "success", "message": "JWT_TOKEN is valid"})
    else:
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401

@app.route('/device/<string:device_id>', methods=['GET'])
def get_device_detail(device_id):
    """Get detailed information for a specific device."""
    logging.info(f"Device detail request for: {device_id}")
    
    # Check if device exists in cache
    if device_id in latest_data:
        info = latest_data[device_id]
        meta = info.get("metadata", {"type": "unknown", "name": "Unknown", "location": "N/A"})
        
        return jsonify({
            "status": "success",
            "device": {
                "id": device_id,
                "type": meta["type"],
                "name": meta["name"],
                "location": meta["location"],
                "attributes": info.get("attributes", {}),
                "telemetry": info.get("telemetry", {})
            }
        })
    
    # Try to fetch fresh data
    get_device_telemetry(device_id)
    get_device_attributes(device_id)
    
    if device_id in latest_data:
        info = latest_data[device_id]
        meta = info.get("metadata", {"type": "unknown", "name": "Unknown", "location": "N/A"})
        
        return jsonify({
            "status": "success",
            "device": {
                "id": device_id,
                "type": meta["type"],
                "name": meta["name"],
                "location": meta["location"],
                "attributes": info.get("attributes", {}),
                "telemetry": info.get("telemetry", {})
            }
        })
    
    return jsonify({"status": "error", "message": "Device not found"}), 404

@app.route('/device/<string:device_id>/history', methods=['GET'])
def get_device_history(device_id):
    """Get historical telemetry data for a device."""
    period = request.args.get('period', 'day')
    logging.info(f"Device history request for: {device_id}, period: {period}")
    
    try:
        # Calculate time range based on period
        now = datetime.now()
        if period == 'week':
            start_time = now - timedelta(days=7)
            limit = 168  # 7 days * 24 hours
        elif period == 'month':
            start_time = now - timedelta(days=30)
            limit = 720  # 30 days * 24 hours
        else:  # day
            start_time = now - timedelta(days=1)
            limit = 24  # 24 hours
        
        start_ts = int(start_time.timestamp() * 1000)
        end_ts = int(now.timestamp() * 1000)
        
        # Fetch historical data from Core IoT
        keys = "ENERGY-Power,ENERGY-Voltage,ENERGY-Current,ENERGY-Today"
        url = f"{CORE_IOT_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries"
        params = {
            "keys": keys,
            "startTs": start_ts,
            "endTs": end_ts,
            "limit": limit * 4,  # Multiple keys
            "agg": "AVG" if period != 'day' else "NONE",
            "interval": 3600000 if period != 'day' else 0  # 1 hour aggregation for week/month
        }
        
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
        
        if response.status_code == 200:
            raw_data = response.json()
            
            # Process and combine data points
            history = []
            timestamps = set()
            
            # Collect all timestamps
            for key, values in raw_data.items():
                for point in values:
                    timestamps.add(point['ts'])
            
            # Create data points for each timestamp
            for ts in sorted(timestamps):
                point = {
                    'timestamp': datetime.fromtimestamp(ts / 1000).isoformat(),
                    'power': 0,
                    'voltage': 0,
                    'current': 0,
                    'energy': 0
                }
                
                for key, values in raw_data.items():
                    for v in values:
                        if v['ts'] == ts:
                            val = float(v['value']) if v['value'] else 0
                            if 'Power' in key:
                                point['power'] = val
                            elif 'Voltage' in key:
                                point['voltage'] = val
                            elif 'Current' in key:
                                point['current'] = val
                            elif 'Today' in key:
                                point['energy'] = val
                            break
                
                history.append(point)
            
            # Limit to requested number of points
            if len(history) > limit:
                step = len(history) // limit
                history = history[::step][:limit]
            
            logging.info(f"Returning {len(history)} history points for device {device_id}")
            return jsonify({"status": "success", "history": history})
        else:
            logging.warning(f"Failed to fetch history from Core IoT: {response.status_code}")
            # Return generated data as fallback
            return jsonify({
                "status": "success", 
                "history": generate_mock_device_history(period),
                "note": "Using generated data"
            })
            
    except Exception as e:
        logging.error(f"Error fetching device history: {e}")
        return jsonify({
            "status": "success",
            "history": generate_mock_device_history(period),
            "note": "Using generated data due to error"
        })

def generate_mock_device_history(period):
    """Generate mock history data for demo purposes."""
    now = datetime.now()
    history = []
    
    if period == 'week':
        count = 168
        interval_minutes = 60
    elif period == 'month':
        count = 720
        interval_minutes = 60
    else:
        count = 24
        interval_minutes = 60
    
    for i in range(count - 1, -1, -1):
        timestamp = now - timedelta(minutes=i * interval_minutes)
        hour = timestamp.hour
        
        # Generate realistic values based on time of day
        if 0 <= hour < 6:
            base_power = 30
        elif 6 <= hour < 9:
            base_power = 150
        elif 9 <= hour < 17:
            base_power = 80
        elif 17 <= hour < 22:
            base_power = 200
        else:
            base_power = 50
        
        power = base_power + random.uniform(-20, 20)
        voltage = 220 + random.uniform(-5, 5)
        current = power / voltage
        
        history.append({
            'timestamp': timestamp.isoformat(),
            'power': round(max(0, power), 2),
            'voltage': round(voltage, 1),
            'current': round(max(0, current), 4),
            'energy': round(max(0, power * (interval_minutes / 60) / 1000), 4)
        })
    
    return history

@app.route('/control/<string:device_id>/<string:command>', methods=['POST'])
def control_specific_device(device_id, command):
    """Control a specific smart plug."""
    logging.info(f"Control request: Device {device_id}, Command: {command}")
    
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401

    if command.lower() not in ['on', 'off']:
        return jsonify({"status": "error", "message": "Invalid command. Only 'on' or 'off' accepted."}), 400

    success, result = send_rpc_to_device(device_id, command.upper())
    
    if success:
        return jsonify(result), 200
    else:
        status_code = 401 if "Token" in result.get("message", "") else 500
        return jsonify(result), status_code

@app.route('/control/group/<string:command>', methods=['POST'])
def control_group_devices(command):
    """Control all smart plugs in group."""
    logging.info(f"Group control request: Command: {command}")
    
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401
        
    if command.lower() not in ['on', 'off']:
        return jsonify({"status": "error", "message": "Invalid command. Only 'on' or 'off' accepted."}), 400

    try:
        device_ids = get_devices_from_group()
        if not device_ids:
            return jsonify({"status": "error", "message": "No devices found in group."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error getting device list: {e}"}), 500

    results = []
    all_success = True
    cmd_upper = command.upper()

    for device_id in device_ids:
        success, result = send_rpc_to_device(device_id, cmd_upper)
        results.append(result)
        if not success:
            all_success = False
        time.sleep(0.1)
        
    summary = {
        "status": "success" if all_success else "partial_failure",
        "command_sent": cmd_upper,
        "total_devices": len(device_ids),
        "results": results
    }
    
    return jsonify(summary), 200 if all_success else 207

# === SCHEDULE ENDPOINTS ===

@app.route('/schedules', methods=['GET'])
def get_schedules():
    """Get all schedules."""
    try:
        schedules = get_all_schedules()
        return jsonify(schedules), 200
    except Exception as e:
        logging.error(f"Error fetching schedules: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/schedules', methods=['POST'])
def create_new_schedule():
    """Create a new schedule."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'targetId', 'action', 'time', 'days']
        for field in required_fields:
            if field not in data:
                return jsonify({"status": "error", "message": f"Missing required field: {field}"}), 400
        
        # Validate action
        if data['action'] not in ['on', 'off']:
            return jsonify({"status": "error", "message": "Action must be 'on' or 'off'"}), 400
        
        # Validate days
        valid_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        if not isinstance(data['days'], list) or not all(d in valid_days for d in data['days']):
            return jsonify({"status": "error", "message": "Days must be a list of valid day abbreviations"}), 400
        
        # Validate time format (HH:MM)
        try:
            datetime.strptime(data['time'], '%H:%M')
        except ValueError:
            return jsonify({"status": "error", "message": "Time must be in HH:MM format"}), 400
        
        enabled = data.get('enabled', True)
        
        schedule = create_schedule(
            name=data['name'],
            target_id=data['targetId'],
            action=data['action'],
            time=data['time'],
            days=data['days'],
            enabled=enabled
        )
        
        logging.info(f"Schedule created: {schedule['id']} - {schedule['name']}")
        
        # Emit to connected clients
        socketio.emit('schedule_created', schedule, room='schedules')
        
        return jsonify(schedule), 201
        
    except Exception as e:
        logging.error(f"Error creating schedule: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/schedules/<string:schedule_id>', methods=['GET'])
def get_single_schedule(schedule_id):
    """Get a single schedule by ID."""
    try:
        schedule = get_schedule_by_id(schedule_id)
        if schedule:
            return jsonify(schedule), 200
        return jsonify({"status": "error", "message": "Schedule not found"}), 404
    except Exception as e:
        logging.error(f"Error fetching schedule {schedule_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/schedules/<string:schedule_id>', methods=['PUT'])
def update_existing_schedule(schedule_id):
    """Update an existing schedule."""
    try:
        data = request.get_json()
        
        # Validate action if provided
        if 'action' in data and data['action'] not in ['on', 'off']:
            return jsonify({"status": "error", "message": "Action must be 'on' or 'off'"}), 400
        
        # Validate days if provided
        if 'days' in data:
            valid_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            if not isinstance(data['days'], list) or not all(d in valid_days for d in data['days']):
                return jsonify({"status": "error", "message": "Days must be a list of valid day abbreviations"}), 400
        
        # Validate time if provided
        if 'time' in data:
            try:
                datetime.strptime(data['time'], '%H:%M')
            except ValueError:
                return jsonify({"status": "error", "message": "Time must be in HH:MM format"}), 400
        
        schedule = update_schedule(
            schedule_id=schedule_id,
            name=data.get('name'),
            target_id=data.get('targetId'),
            action=data.get('action'),
            time=data.get('time'),
            days=data.get('days'),
            enabled=data.get('enabled')
        )
        
        if schedule:
            logging.info(f"Schedule updated: {schedule_id}")
            socketio.emit('schedule_updated', schedule, room='schedules')
            return jsonify(schedule), 200
            
        return jsonify({"status": "error", "message": "Schedule not found"}), 404
        
    except Exception as e:
        logging.error(f"Error updating schedule {schedule_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/schedules/<string:schedule_id>', methods=['DELETE'])
def delete_existing_schedule(schedule_id):
    """Delete a schedule."""
    try:
        success = delete_schedule(schedule_id)
        if success:
            logging.info(f"Schedule deleted: {schedule_id}")
            socketio.emit('schedule_deleted', {"id": schedule_id}, room='schedules')
            return jsonify({"status": "success", "message": "Schedule deleted"}), 200
        return jsonify({"status": "error", "message": "Schedule not found"}), 404
    except Exception as e:
        logging.error(f"Error deleting schedule {schedule_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/schedules/<string:schedule_id>/toggle', methods=['POST'])
def toggle_schedule(schedule_id):
    """Toggle schedule enabled/disabled status."""
    try:
        schedule = get_schedule_by_id(schedule_id)
        if not schedule:
            return jsonify({"status": "error", "message": "Schedule not found"}), 404
        
        updated = update_schedule(schedule_id=schedule_id, enabled=not schedule['enabled'])
        if updated:
            logging.info(f"Schedule {schedule_id} toggled to {'enabled' if updated['enabled'] else 'disabled'}")
            socketio.emit('schedule_updated', updated, room='schedules')
            return jsonify(updated), 200
            
        return jsonify({"status": "error", "message": "Failed to toggle schedule"}), 500
        
    except Exception as e:
        logging.error(f"Error toggling schedule {schedule_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# === FORECAST ENDPOINTS (if enabled) ===

if FORECAST_ENABLED:
    @app.route('/forecast', methods=['GET'])
    def trigger_forecast():
        """Manually trigger AI forecast."""
        global predicted_details_cache
        logging.info("--- MANUAL FORECAST TRIGGERED ---")
        
        with lock:
            if len(hourly_kwh_global) < 1:
                return jsonify({"status": "error", "message": "Not enough data"}), 400
            
            now = datetime.now()
            start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            consumed = sum(v for k, v in hourly_kwh_global.items() if datetime.fromisoformat(k) >= start_of_month)
            recent_history = dict(sorted(hourly_kwh_global.items(), key=lambda x: x[0], reverse=True)[:1200])

        logging.info(f"Sending request to AI Server... (Consumed: {consumed:.2f} kWh)")
        
        result = forecast_client.predict(recent_history, consumed)
        
        if result:
            predicted_details_cache = result.get("PredictedHourlyDetails", {})
            logging.info(f"FORECAST SUCCESS -> Bill: {result['PredictedBillVND']:,} VND")
            
            try:
                with open("forecast_result.json", "w", encoding='utf-8') as f:
                    json.dump(result, f, indent=4, ensure_ascii=False)
            except:
                pass
            
            return jsonify(result)
        else:
            return jsonify({"status": "error", "message": "AI Server not responding"}), 500

    @app.route('/forecast/summary', methods=['GET'])
    def get_forecast_summary():
        """API trả về tóm tắt kết quả dự báo (đọc từ cache)."""  
        try:
            # Kiểm tra xem file kết quả có tồn tại không
            if os.path.exists("forecast_result.json"):
                with open("forecast_result.json", "r", encoding='utf-8') as f:
                    full_result = json.load(f)
                
                # Trích xuất 3 thông số bạn yêu cầu
                summary_data = {
                    "tien_can_tra_vnd": full_result.get("PredictedBillVND", 0),
                    "tong_kwh_du_doan_duoc": full_result.get("TotalKwhForecasted", 0),
                    "tong_kwh_ca_thang": full_result.get("TotalKwhMonth", 0)
                }
                
                return jsonify({
                    "status": "success",
                    "data": summary_data
                })
            else:
                return jsonify({
                    "status": "empty", 
                    "message": "Chưa có dữ liệu dự báo. Vui lòng nhấn nút 'Dự báo' trước."
                }), 404
                
        except Exception as e:
            logging.error(f"Error reading forecast summary: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

    # Giá điện (VND/kWh)
    PRICE_PER_KWH = 2500

    @app.route('/energy', methods=['GET'])
    def get_energy_data():
        """API trả về dữ liệu tiêu thụ điện theo giờ với chi phí."""
        period = request.args.get('period', 'day')
        
        # Tính toán mốc thời gian CHẶN DƯỚI (start_time)
        now = datetime.now()
        
        start_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if period == 'day':
            start_time = start_of_today
            
        elif period == 'week':
            seven_days_ago = now - timedelta(days=7)
            start_time = max(seven_days_ago, start_of_this_month)
            
        elif period == 'month':
            start_time = start_of_this_month
            
        else:
            start_time = now - timedelta(hours=24)

        response_data = []

        with lock:
            # Sort dữ liệu
            sorted_items = sorted(hourly_kwh_global.items(), key=lambda x: x[0])
            recent_items = sorted_items[-750:]
            
            for iso_ts, kwh in recent_items:
                try:
                    dt_obj = datetime.fromisoformat(iso_ts)
                    if dt_obj >= start_time:
                        response_data.append({
                            "timestamp": iso_ts,
                            "consumption": kwh,
                            "cost": kwh * PRICE_PER_KWH
                        })
                except ValueError:
                    continue

        return jsonify(response_data)

# === SOCKET.IO EVENT HANDLERS ===

@socketio.on('connect')
def handle_connect():
    """Client connected to Socket.IO server."""
    logging.info(f"Client connected: {request.sid}")
    emit('response', {'data': 'Connected to Socket.IO server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected from Socket.IO server."""
    logging.info(f"Client disconnected: {request.sid}")
    # Xóa threshold của user khi họ thoát để tránh rác bộ nhớ
    if request.sid in client_thresholds:
        del client_thresholds[request.sid]

@socketio.on('join_dashboard')
def handle_join_dashboard():
    """Client join dashboard room để nhận realtime updates."""
    join_room('dashboard')
    logging.info(f"Client {request.sid} joined room 'dashboard'")
    
    # Gửi ngay dữ liệu Snapshot hiện có cho client mới vào
    data_list = []
    for device_id, info in latest_data.items():
        meta = info.get("metadata", {"type": "unknown", "name": "Unknown", "location": "N/A"})
        data_list.append({
            "id": device_id,
            "type": meta["type"],
            "name": meta["name"],
            "location": meta["location"],
            "attributes": info.get("attributes", {}),
            "telemetry": info.get("telemetry", {})
        })
    emit('dashboard_update', {"data": data_list})

@socketio.on('join_logs')
def handle_join_logs():
    """Client join logs room để nhận activity logs realtime."""
    join_room('logs')
    logging.info(f"Client {request.sid} joined room 'logs'")

@socketio.on('set_alert_threshold')
def handle_set_threshold(data):
    """Client gửi ngưỡng cảnh báo lên server."""
    try:
        threshold = float(data.get('threshold', 100))
        client_thresholds[request.sid] = threshold
        join_room('alert')
        logging.info(f"Client {request.sid} set threshold: {threshold}A")
        
        # Emit activity log
        log_entry = {
            'id': f'log-{int(time.time() * 1000)}',
            'action': 'Cài đặt ngưỡng cảnh báo',
            'deviceId': None,
            'deviceName': None,
            'user': 'Hệ thống',
            'timestamp': datetime.now().isoformat(),
            'details': f'Ngưỡng: {threshold}A'
        }
        emit('activity_log', log_entry)
    except ValueError:
        logging.error(f"Invalid threshold value from client {request.sid}")
        pass

@socketio.on('subscribe_devices')
def handle_subscribe_devices():
    """Client subscribes to device updates (legacy support)."""
    logging.info(f"Client {request.sid} subscribed to device updates")
    emit('response', {'data': 'Subscribed to device updates'})
    join_room('device_updates')

@socketio.on('unsubscribe_devices')
def handle_unsubscribe_devices():
    """Client unsubscribes from device updates (legacy support)."""
    logging.info(f"Client {request.sid} unsubscribed from device updates")
    leave_room('device_updates')

@socketio.on('join_schedules')
def handle_join_schedules():
    """Client join schedules room để nhận schedule updates realtime."""
    join_room('schedules')
    logging.info(f"Client {request.sid} joined room 'schedules'")
    
@socketio.on('leave_schedules')
def handle_leave_schedules():
    """Client leave schedules room."""
    leave_room('schedules')
    logging.info(f"Client {request.sid} left room 'schedules'")

# === MAIN ===

if __name__ == "__main__":
    print("=" * 60)
    print(" SMART HOME BACKEND - FULL FEATURES")
    print("=" * 60)
    print(f" Forecast Enabled: {FORECAST_ENABLED}")
    print(" Auto-Shutdown Enabled: True")
    print(" Activity Logs Enabled: True")
    print(" Realtime Alerts Enabled: True")
    print(" Schedule Executor Enabled: True")
    print("=" * 60)
    
    # Start background threads
    threading.Thread(target=periodic_data_logger, daemon=True).start()
    threading.Thread(target=start_websocket, daemon=True).start()
    threading.Thread(target=schedule_executor, daemon=True).start()
    
    # Initialize dummy data if forecast enabled
    if FORECAST_ENABLED:
        init_dummy_data()
    
    print(" Server starting on http://0.0.0.0:5000")
    print(" Schedule executor running...")
    print("=" * 60)
    
    # Run Socket.IO server
    socketio.run(app, debug=True, port=5000, host='0.0.0.0', allow_unsafe_werkzeug=True)