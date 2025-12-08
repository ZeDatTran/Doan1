from ensemble_model import ModelEnsemble
import joblib

print("Đang tạo file ensemble_model.pkl...")
model = ModelEnsemble()
joblib.dump(model, "ensemble_model.pkl")
print("Đã tạo ensemble_model.pkl thành công.")