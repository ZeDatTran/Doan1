import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.neural_network import MLPRegressor
import xgboost as xgb
import joblib
import os

def create_features(df):
    df = df.copy()
    df['hour'] = df.index.hour
    df['dayofweek'] = df.index.dayofweek
    df['month'] = df.index.month
    df['is_weekend'] = (df.index.dayofweek >= 5).astype(int)
    df['kwh_lag_24h'] = df['kwh_hour'].shift(24)
    df['kwh_lag_48h'] = df['kwh_hour'].shift(48)
    df['kwh_lag_168h'] = df['kwh_hour'].shift(168)
    df['kwh_rolling_mean_24h'] = df['kwh_hour'].shift(24).rolling(window=24).mean()
    return df.dropna()

def train_all_models(use_personal_data=False):
    FEATURES = ['hour','dayofweek','month','is_weekend',
                'kwh_lag_24h','kwh_lag_48h','kwh_lag_168h','kwh_rolling_mean_24h']
    TARGET = 'kwh_hour'

    # Simulate history nếu không có DB
    history = {}  # Thay bằng get_all_history() nếu dùng DB thật

    if use_personal_data and os.path.exists("data/power_history.db"):
        # history = get_all_history()
        if len(history) >= 2000:
            print(f"Using personal data: {len(history)} hours")
            df = pd.DataFrame([{"datetime": k, "kwh_hour": v} for k,v in history.items()])
            df['datetime'] = pd.to_datetime(df['datetime'])
            df = df.set_index('datetime')
            use_personal_data = True
        else:
            print("Personal data < 2000 hours → use UCI")
            use_personal_data = False
    else:
        print("No personal DB or disabled → use UCI")
        use_personal_data = False

    if not use_personal_data:
        path = "household_power_consumption.txt"
        if not os.path.exists(path):
            raise FileNotFoundError("Need household_power_consumption.txt")
        df_raw = pd.read_csv(path, sep=';', na_values=['?'], low_memory=False)
        df_raw['datetime'] = pd.to_datetime(df_raw['Date'] + ' ' + df_raw['Time'], dayfirst=True)
        df_raw = df_raw.set_index('datetime').ffill()
        df_hourly = df_raw['Global_active_power'].astype(float).resample('h').mean()
        df = df_hourly.to_frame(name='kwh_hour')

    df_features = create_features(df)
    X = df_features[FEATURES]
    y = df_features[TARGET]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, "scaler.pkl")

    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.1, shuffle=False)
    os.makedirs("models", exist_ok=True)

    print("\n🔨 Training models...")
    
    # [PRIORITY 1] XGBoost - Tốt nhất cho time series
    print("  [1/4] Training XGBoost...")
    model_xgb = xgb.XGBRegressor(
        n_estimators=300,      # Tăng từ 200
        learning_rate=0.02,    # Giảm để học chậm hơn, chính xác hơn
        max_depth=6,           # Thêm depth
        random_state=42, 
        n_jobs=-1
    )
    model_xgb.fit(X_train, y_train)
    joblib.dump(model_xgb, "models/model_xgb.pkl")
    
    # [PRIORITY 2] Random Forest - Rất ổn định
    print("  [2/4] Training Random Forest...")
    model_rf = RandomForestRegressor(
        n_estimators=100,      # Tăng từ 50
        max_depth=15,          # Thêm depth
        random_state=42, 
        n_jobs=-1
    )
    model_rf.fit(X_train, y_train)
    joblib.dump(model_rf, "models/model_rf.pkl")
    
    # [PRIORITY 3] MLP - Có thể học non-linear
    print("  [3/4] Training MLP...")
    model_mlp = MLPRegressor(
        hidden_layer_sizes=(64, 32, 16),  # Thêm layers
        max_iter=300,                      # Tăng iterations
        activation='relu',
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1
    )
    model_mlp.fit(X_train, y_train)
    joblib.dump(model_mlp, "models/model_mlp.pkl")
    
    # [OPTIONAL] Linear Regression - Chỉ để so sánh
    print("  [4/4] Training Linear Regression (baseline)...")
    model_lr = LinearRegression()
    model_lr.fit(X_train, y_train)
    joblib.dump(model_lr, "models/model_lr.pkl")

    # Evaluate
    scores = {
        "xgb": round(model_xgb.score(X_test, y_test), 4),
        "rf": round(model_rf.score(X_test, y_test), 4),
        "mlp": round(model_mlp.score(X_test, y_test), 4),
        "lr": round(model_lr.score(X_test, y_test), 4),
    }

    print(f"\n TRAINING COMPLETE!")
    print(f" R² Scores:")
    print(f"   XGBoost:      {scores['xgb']} ")
    print(f"   RandomForest: {scores['rf']} ")
    print(f"   MLP:          {scores['mlp']} ")
    print(f"   LinearReg:    {scores['lr']}  (baseline)")
    print(f"\nEnsemble will use: XGBoost + RandomForest (+ MLP if stable)")
    
    return scores

if __name__ == "__main__":
    train_all_models(use_personal_data=True)
    print("\n Creating ensemble model...")
    os.system("python run_ensemble.py")