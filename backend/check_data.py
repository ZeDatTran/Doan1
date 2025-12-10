#!/usr/bin/env python3
"""
Script kiểm tra dữ liệu đã thu thập được
Chạy: python check_data.py
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta
from collections import defaultdict

DB_PATH = "data/power_history.db"

def check_database_exists():
    """Kiểm tra file database có tồn tại không"""
    if os.path.exists(DB_PATH):
        size = os.path.getsize(DB_PATH)
        print(f"✅ Database tồn tại: {DB_PATH}")
        print(f"📦 Kích thước: {size:,} bytes ({size/1024:.2f} KB)")
        return True
    else:
        print(f"❌ Database KHÔNG tồn tại: {DB_PATH}")
        return False

def check_hourly_kwh_data():
    """Kiểm tra dữ liệu trong bảng hourly_kwh"""
    print("\n" + "="*60)
    print("📊 BẢNG HOURLY_KWH - Dữ liệu tiêu thụ điện theo giờ")
    print("="*60)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            # Đếm tổng số record
            cur.execute("SELECT COUNT(*) as count FROM hourly_kwh")
            total = cur.fetchone()["count"]
            print(f"\n📈 Tổng số record: {total}")
            
            if total == 0:
                print("⚠️  KHÔNG có dữ liệu nào trong database!")
                return
            
            # Lấy thời gian đầu và cuối
            cur.execute("SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM hourly_kwh")
            row = cur.fetchone()
            print(f"🕐 Thời gian đầu tiên: {row['first']}")
            print(f"🕐 Thời gian mới nhất: {row['last']}")
            
            # Tính tổng kWh
            cur.execute("SELECT SUM(kwh) as total_kwh FROM hourly_kwh")
            total_kwh = cur.fetchone()["total_kwh"]
            print(f"⚡ Tổng điện tiêu thụ: {total_kwh:.2f} kWh")
            
            # Lấy 10 record mới nhất
            print(f"\n📋 10 record MỚI NHẤT:")
            print("-" * 60)
            print(f"{'Thời gian':<20} {'kWh':>10}")
            print("-" * 60)
            
            cur.execute("""
                SELECT timestamp, kwh 
                FROM hourly_kwh 
                ORDER BY timestamp DESC 
                LIMIT 10
            """)
            
            for row in cur.fetchall():
                print(f"{row['timestamp']:<20} {row['kwh']:>10.4f}")
            
            # Thống kê theo ngày
            print(f"\n📅 THỐNG KÊ THEO NGÀY (7 ngày gần nhất):")
            print("-" * 60)
            print(f"{'Ngày':<12} {'Số giờ':>10} {'Tổng kWh':>12} {'TB/giờ':>12}")
            print("-" * 60)
            
            cur.execute("""
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as hours,
                    SUM(kwh) as total,
                    AVG(kwh) as avg
                FROM hourly_kwh
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY DATE(timestamp)
                ORDER BY date DESC
            """)
            
            for row in cur.fetchall():
                print(f"{row['date']:<12} {row['hours']:>10} {row['total']:>12.2f} {row['avg']:>12.4f}")
                
    except sqlite3.Error as e:
        print(f"❌ Lỗi database: {e}")

def check_training_log():
    """Kiểm tra log huấn luyện model AI"""
    print("\n" + "="*60)
    print("🤖 BẢNG TRAINING_LOG - Lịch sử huấn luyện AI")
    print("="*60)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            cur.execute("SELECT COUNT(*) as count FROM training_log")
            total = cur.fetchone()["count"]
            print(f"\n📈 Tổng số lần train: {total}")
            
            if total == 0:
                print("⚠️  Chưa có lịch sử train AI")
                return
            
            cur.execute("""
                SELECT * FROM training_log 
                ORDER BY date DESC 
                LIMIT 5
            """)
            
            print(f"\n📋 5 lần train GẦN NHẤT:")
            print("-" * 80)
            print(f"{'Ngày':<12} {'R2_RF':>8} {'R2_XGB':>8} {'R2_MLP':>8} {'R2_LR':>8} {'Note':<20}")
            print("-" * 80)
            
            for row in cur.fetchall():
                print(f"{row['date']:<12} {row['r2_rf']:>8.4f} {row['r2_xgb']:>8.4f} "
                      f"{row['r2_mlp']:>8.4f} {row['r2_lr']:>8.4f} {row['note']:<20}")
                
    except sqlite3.Error as e:
        print(f"❌ Lỗi database: {e}")

def check_forecast_result():
    """Kiểm tra file kết quả dự báo"""
    print("\n" + "="*60)
    print("🔮 FILE FORECAST_RESULT.JSON - Kết quả dự báo")
    print("="*60)
    
    if not os.path.exists("forecast_result.json"):
        print("⚠️  File forecast_result.json KHÔNG tồn tại")
        print("💡 Chạy endpoint /forecast để tạo dự báo")
        return
    
    try:
        with open("forecast_result.json", "r", encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n✅ File tồn tại")
        print(f"📦 Kích thước: {os.path.getsize('forecast_result.json'):,} bytes")
        
        print(f"\n📊 KẾT QUẢ DỰ BÁO:")
        print(f"💰 Tiền điện dự kiến: {data.get('PredictedBillVND', 0):,.0f} VNĐ")
        print(f"⚡ Tổng kWh dự báo: {data.get('TotalKwhForecasted', 0):.2f} kWh")
        print(f"⚡ Tổng kWh cả tháng: {data.get('TotalKwhMonth', 0):.2f} kWh")
        
        details = data.get('PredictedHourlyDetails', {})
        print(f"📋 Số giờ dự báo chi tiết: {len(details)}")
        
    except Exception as e:
        print(f"❌ Lỗi đọc file: {e}")

def check_logs():
    """Kiểm tra file log"""
    print("\n" + "="*60)
    print("📝 FILE LOG - Nhật ký hệ thống")
    print("="*60)
    
    log_file = "logs/telemetry.log"
    
    if not os.path.exists(log_file):
        print(f"⚠️  File log KHÔNG tồn tại: {log_file}")
        return
    
    size = os.path.getsize(log_file)
    print(f"\n✅ File tồn tại: {log_file}")
    print(f"📦 Kích thước: {size:,} bytes ({size/1024:.2f} KB)")
    
    # Đọc 20 dòng cuối
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        print(f"📊 Tổng số dòng: {len(lines)}")
        print(f"\n📋 20 DÒNG CUỐI CÙNG:")
        print("-" * 80)
        
        for line in lines[-20:]:
            print(line.rstrip())
            
    except Exception as e:
        print(f"❌ Lỗi đọc file: {e}")

def export_data_to_csv():
    """Export dữ liệu ra file CSV để xem dễ hơn"""
    print("\n" + "="*60)
    print("💾 EXPORT DỮ LIỆU RA CSV")
    print("="*60)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            
            # Export hourly_kwh
            cur.execute("SELECT * FROM hourly_kwh ORDER BY timestamp")
            rows = cur.fetchall()
            
            if rows:
                with open("hourly_kwh_export.csv", "w", encoding='utf-8') as f:
                    f.write("timestamp,kwh\n")
                    for row in rows:
                        f.write(f"{row[0]},{row[1]}\n")
                
                print(f"✅ Đã export {len(rows)} records vào: hourly_kwh_export.csv")
            else:
                print("⚠️  Không có dữ liệu để export")
                
    except Exception as e:
        print(f"❌ Lỗi export: {e}")

def main():
    """Chạy tất cả kiểm tra"""
    print("="*60)
    print("🔍 CÔNG CỤ KIỂM TRA DỮ LIỆU THU THẬP")
    print("="*60)
    
    if not check_database_exists():
        print("\n💡 HƯỚNG DẪN:")
        print("1. Đảm bảo app.py đang chạy")
        print("2. Đảm bảo FORECAST_ENABLED = True")
        print("3. Đảm bảo có dữ liệu ENERGY-Total từ thiết bị")
        return
    
    check_hourly_kwh_data()
    check_training_log()
    check_forecast_result()
    check_logs()
    
    print("\n" + "="*60)
    response = input("📤 Bạn có muốn export dữ liệu ra CSV không? (y/n): ")
    if response.lower() == 'y':
        export_data_to_csv()
    
    print("\n✅ HOÀN THÀNH KIỂM TRA!")
    print("="*60)

if __name__ == "__main__":
    main()