@echo off
REM ARAVINDHA ML service — trains on first run if model missing, then serves on :8000
cd /d "%~dp0..\ml-service"
if not exist app\model.joblib (
  echo Training model first...
  python -m app.train_model
)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
