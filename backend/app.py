from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import requests
import websocket
import json
import logging
from datetime import datetime
from dotenv import load_dotenv
import os
import time
import threading
from flask_cors import CORS  # import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Tải biến môi trường từ .env
load_dotenv()
CORE_IOT_URL = "https://app.coreiot.io"
JWT_TOKEN = os.getenv("JWT_TOKEN")
DEVICE_ID = os.getenv("DEVICE_ID")  # Device mặc định (dùng làm fallback)
GROUP_ID = os.getenv("GROUP_ID")  # Group ID cho nhiều devices
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}"}

# Kiểm tra biến môi trường
if not all([JWT_TOKEN, DEVICE_ID, GROUP_ID]):
    raise ValueError("JWT_TOKEN, DEVICE_ID và GROUP_ID phải được thiết lập trong file .env")

# Tạo thư mục logs nếu chưa tồn tại
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# Cấu hình logging
logging.basicConfig(
    filename=os.path.join(log_dir, 'telemetry.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Telemetry keys từ smart plug
TELEMETRY_KEYS = ["ENERGY-Voltage", "ENERGY-Current", "ENERGY-Power", "ENERGY-Today",
                  "ENERGY-Total", "ENERGY-Factor"]

# Danh sách type và location cho devices (theo thứ tự)
DEVICE_TYPES = ["light", "fan", "ac", "sensor", "camera"]
DEVICE_LOCATIONS = ["Phòng khách", "Phòng ngủ", "Phòng làm việc", "Phòng ăn", "Ban công"]

# Lưu trữ dữ liệu mới nhất (hỗ trợ nhiều devices)
latest_data = {}

subscription_to_device_map = {}

# --- Các hàm Core IoT (Giữ nguyên) ---

def verify_token():
    """Kiểm tra token hợp lệ."""
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
        logging.error(f"Error fetching devices from group {GROUP_ID}: {e}, Status Code: {getattr(e.response, 'status_code', 'N/A')}")
        
        # Fallback: Lấy tất cả devices trong tenant nếu không lấy được từ group
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
            logging.error(f"Error fetching tenant devices (fallback): {e_fallback}, Status Code: {getattr(e_fallback.response, 'status_code', 'N/A')}")
           
            logging.warning(f"Fallback: Using default DEVICE_ID {DEVICE_ID}")
            return [DEVICE_ID]

def get_device_telemetry(device_id):
    try:
        response = requests.get(
            f"{CORE_IOT_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries?keys={','.join(TELEMETRY_KEYS)}&limit=1",
            headers=HEADERS,
            timeout=15
        )
        response.raise_for_status()
        telemetry = response.json()
        
        if device_id not in latest_data:
            latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}}
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
        logging.error(f"Error fetching telemetry for device {device_id}: {e}, Status Code: {getattr(e.response, 'status_code', 'N/A')}")
        return {}
    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON telemetry for device {device_id}")
        return {}

def get_device_attributes(device_id):
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
            latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}}
            
        latest_data[device_id]["attributes"]["POWER"] = power_attr["value"]
        logging.info(f"POWER attribute received for device {device_id}: {power_attr['value']}")
        return attributes
    except requests.RequestException as e:
        logging.error(f"Error fetching attributes for device {device_id}: {e}, Status Code: {getattr(e.response, 'status_code', 'N/A')}")
        return []
    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON attributes for device {device_id}")
        return []

# --- (PHẦN MỚI) Hàm gửi RPC được tích hợp ---

def send_rpc_to_device(device_id, command, retries=3):
    """Gửi lệnh RPC (POWER: ON/OFF) tới một device cụ thể với retry logic."""
    
    # Sử dụng URL và HEADERS chung đã được định nghĩa ở trên
    api_url = f"{CORE_IOT_URL}/api/rpc/oneway/{device_id}"
    
    payload = {
        "method": "POWER",
        "params": command.upper()
    }
    
    for attempt in range(retries):
        try:        
            response = requests.post(api_url, headers=HEADERS, json=payload, timeout=15)
            
            if response.status_code == 200:
                logging.info(f"Da gui lenh RPC '{command}' toi {device_id} thanh cong.")
                return True, {"status": "success", "device_id": device_id, "command_sent": command}
            
            elif response.status_code == 401: 
                logging.warning(f"Loi 401 khi gui RPC toi {device_id}: Token khong hop le.")
                return False, {"status": "error", "message": "Token (JWT) da het han hoac khong hop le."}
                
            else: 
                logging.error(f"Loi khi gui RPC tới {device_id}: {response.status_code} - {response.text}")
                return False, {"status": "error", "message": response.text, "device_id": device_id}
                
        except requests.exceptions.Timeout as e:
            logging.warning(f"Timeout attempt {attempt + 1}/{retries} khi gui RPC toi {device_id}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
            else:
                logging.error(f"Tất cả {retries} lần thử đã thất bại khi gửi RPC tới {device_id}")
                return False, {"status": "error", "message": "Device không phản hồi sau nhiều lần thử. Vui lòng kiểm tra kết nối.", "device_id": device_id}
        except requests.exceptions.RequestException as e:
            logging.error(f"Loi ket noi khi gui RPC toi {device_id}: {e}")
            return False, {"status": "error", "message": str(e), "device_id": device_id}



def periodic_data_logger():
    while True:
        logging.info("Periodic check: Starting data fetch cycle for group")
        if verify_token():
            devices = get_devices_from_group()
            for device_id in devices:
                get_device_telemetry(device_id)
                get_device_attributes(device_id)
                time.sleep(0.1) # Tránh spam API
        else:
            logging.warning("Periodic check: Cannot fetch data due to invalid token")
        time.sleep(10)

def start_websocket():
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
                    latest_data[device_id] = {"telemetry": {}, "attributes": {"POWER": "N/A"}}

                # Xử lý Telemetry
                telemetry_keys_found = {key: telemetry_data[key][0][1] for key in TELEMETRY_KEYS if key in telemetry_data}
                if telemetry_keys_found:
                    latest_data[device_id]["telemetry"].update(telemetry_keys_found)
                    logging.info(f"Real-time telemetry for {device_id}: {telemetry_keys_found}")
                    # Emit update via Socket.IO
                    socketio.emit('device_update', {
                        'device_id': device_id,
                        'telemetry': latest_data[device_id]["telemetry"],
                        'attributes': latest_data[device_id]["attributes"]
                    }, room='device_updates')

                # Xử lý Attribute (POWER)
                if "POWER" in telemetry_data:
                    power_val = telemetry_data["POWER"][0][1]
                    latest_data[device_id]["attributes"]["POWER"] = power_val
                    logging.info(f"Real-time attribute for {device_id}: POWER = {power_val}")
                    # Emit update via Socket.IO
                    socketio.emit('device_update', {
                        'device_id': device_id,
                        'telemetry': latest_data[device_id]["telemetry"],
                        'attributes': latest_data[device_id]["attributes"]
                    }, room='device_updates')
            
        except json.JSONDecodeError as e:
            logging.error(f"Error decoding WebSocket message: {e} - Message: {message}")
        except Exception as e:
            logging.error(f"Error processing WebSocket message: {e} (Type: {type(e).__name__}) - Data: {data}")
    
    def on_error(ws, error):
        logging.error(f"WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        logging.warning(f"WebSocket closed: Status {close_status_code}, Message: {close_msg}")
    
    def on_open(ws):
        logging.info("WebSocket connection opened, subscribing to device group...")
        global subscription_to_device_map
        subscription_to_device_map.clear() # Xóa map cũ mỗi khi kết nối lại
        
        try:
            device_ids = get_devices_from_group()
            if not device_ids:
                logging.error("WebSocket: Could not get device list, subscription failed.")
                return

            ts_sub_cmds = []
            attr_sub_cmds = []
            cmd_id_counter = 1 # Bộ đếm ID duy nhất

            for dev_id in device_ids:
                # 1. Tạo sub Telemetry
                ts_cmd_id = cmd_id_counter
                ts_sub_cmds.append({
                    "entityType": "DEVICE",
                    "entityId": dev_id,
                    "scope": "LATEST_TELEMETRY",
                    "keys": ",".join(TELEMETRY_KEYS),
                    "cmdId": ts_cmd_id
                })
                subscription_to_device_map[ts_cmd_id] = dev_id
                cmd_id_counter += 1
                
                # 2. Tạo sub Attribute (POWER)
                attr_cmd_id = cmd_id_counter
                attr_sub_cmds.append({
                    "entityType": "DEVICE",
                    "entityId": dev_id,
                    "scope": "CLIENT_SCOPE",
                    "keys": "POWER",
                    "cmdId": attr_cmd_id
                })
                subscription_to_device_map[attr_cmd_id] = dev_id
                cmd_id_counter += 1

            # Gửi 1 message lớn chứa TẤT CẢ subscription
            subscription_message = {
                "tsSubCmds": ts_sub_cmds,
                "attrSubCmds": attr_sub_cmds
            }
            ws.send(json.dumps(subscription_message))
            logging.info(f"WebSocket: Subscribed to {len(device_ids)} devices.")

        except Exception as e:
            logging.error(f"Error during WebSocket subscription: {e}")
    
    # Vòng lặp kết nối lại
    while True:
        if verify_token():
            try:
                ws = websocket.WebSocketApp(ws_url, on_message=on_message, on_error=on_error, on_open=on_open, on_close=on_close)
                ws.run_forever(ping_interval=30, ping_timeout=10)
            except Exception as e:
                logging.error(f"WebSocket connection failed: {e}. Retrying in 30 seconds")
        else:
            logging.error("Cannot start WebSocket due to invalid JWT_TOKEN. Retrying in 30 seconds")
        
        logging.info("WebSocket connection closed. Retrying in 30 seconds...")
        time.sleep(30)


@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "success", "message": "Smart Plug Backend. Use /check-data, /check-token, or /control."})

@app.route('/check-data', methods=['GET'])
def check_data():
    """API kiểm tra dữ liệu (trả về tất cả devices trong group)."""
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401
    
    if not latest_data:
        logging.warning("/check-data called but no data cached yet. Forcing fetch.")
        devices = get_devices_from_group()
        for device_id in devices:
            get_device_telemetry(device_id)
            get_device_attributes(device_id)
            
    data_array = []
    for idx, (device_id, info) in enumerate(latest_data.items()):
        # Gán type và location theo thứ tự, reset khi hết giá trị
        device_type = DEVICE_TYPES[idx % len(DEVICE_TYPES)]
        device_location = DEVICE_LOCATIONS[idx % len(DEVICE_LOCATIONS)]
        
        data_array.append({
            "type": device_type,
            "location": device_location,
            "id": device_id,
            "attributes": info.get("attributes", {}),
            "telemetry": info.get("telemetry", {})
        })

    logging.info(f"API response for /check-data (group) - as array: {data_array}")
    return jsonify({"status": "success", "data": data_array})

@app.route('/check-token', methods=['GET'])
def check_token():
    """API để kiểm tra token."""
    if verify_token():
        return jsonify({"status": "success", "message": "JWT_TOKEN is valid"})
    else:
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401

# --- (PHẦN MỚI) API Endpoints (Điều khiển) ---

@app.route('/control/<string:device_id>/<string:command>', methods=['POST'])
def control_specific_device(device_id, command):
    """
    API endpoint để điều khiển MỘT Smart Plug cụ thể.
    command phải là 'on' hoặc 'off'.
    """
    logging.info(f"Yêu cầu điều khiển: Device {device_id}, Lệnh: {command}")
    
    # 1. Kiểm tra Token
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401

    # 2. Kiểm tra command hợp lệ
    if command.lower() not in ['on', 'off']:
        return jsonify({"status": "error", "message": "Lệnh không hợp lệ. Chỉ chấp nhận 'on' hoặc 'off'."}), 400

    # 3. Gửi lệnh
    success, result = send_rpc_to_device(device_id, command.upper())
    
    if success:
        return jsonify(result), 200
    else:
        # Lỗi có thể là 401 (token hết hạn) hoặc 500 (lỗi server/device)
        status_code = 401 if "Token" in result.get("message", "") else 500
        return jsonify(result), status_code

@app.route('/control/group/<string:command>', methods=['POST'])
def control_group_devices(command):
    """
    API endpoint để điều khiển TẤT CẢ Smart Plug trong GROUP.
    command phải là 'on' hoặc 'off'.
    """
    logging.info(f"Yêu cầu điều khiển NHÓM: Lệnh: {command}")
    
    # 1. Kiểm tra Token
    if not verify_token():
        return jsonify({"status": "error", "message": "Invalid JWT_TOKEN"}), 401
        
    # 2. Kiểm tra command hợp lệ
    if command.lower() not in ['on', 'off']:
        return jsonify({"status": "error", "message": "Lenh khong hop le. Chi chap nhan 'on' hoac 'off'."}), 400

    # 3. Lấy danh sách devices từ group
    try:
        device_ids = get_devices_from_group()
        if not device_ids:
            return jsonify({"status": "error", "message": "Khong tim thay thiet bi nao trong nhom."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"Loi khi lay danh sach nhom: {e}"}), 500

    # 4. Gửi lệnh tới tất cả
    results = []
    all_success = True
    cmd_upper = command.upper()

    for device_id in device_ids:
        success, result = send_rpc_to_device(device_id, cmd_upper)
        results.append(result)
        if not success:
            all_success = False
        time.sleep(0.1) # Thêm một chút delay để tránh spam API
        
    summary = {
        "status": "success" if all_success else "partial_failure",
        "command_sent": cmd_upper,
        "total_devices": len(device_ids),
        "results": results
    }
    
    # Trả về 200 nếu tất cả thành công, 207 (Multi-Status) nếu có một số lỗi
    return jsonify(summary), 200 if all_success else 207

# --- Socket.IO Event Handlers ---

@socketio.on('connect')
def handle_connect():
    """Client kết nối tới Socket.IO server."""
    logging.info(f"Client connected: {request.sid}")
    emit('response', {'data': 'Connected to Socket.IO server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Client ngắt kết nối khỏi Socket.IO server."""
    logging.info(f"Client disconnected: {request.sid}")

@socketio.on('subscribe_devices')
def handle_subscribe_devices():
    """Client subscribe để nhận cập nhật devices."""
    logging.info(f"Client {request.sid} subscribed to device updates")
    emit('response', {'data': 'Subscribed to device updates'})
    join_room('device_updates')

@socketio.on('unsubscribe_devices')
def handle_unsubscribe_devices():
    """Client unsubscribe khỏi cập nhật devices."""
    logging.info(f"Client {request.sid} unsubscribed from device updates")
    leave_room('device_updates')

if __name__ == "__main__":
    # Khởi động thread tự động cập nhật API
    threading.Thread(target=periodic_data_logger, daemon=True).start()
    threading.Thread(target=start_websocket, daemon=True).start()
    socketio.run(app, debug=True, port=5000, host='0.0.0.0', allow_unsafe_werkzeug=True)