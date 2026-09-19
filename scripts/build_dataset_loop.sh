#!/bin/bash
# ARAVINDHA — full unattended ML pipeline:
#   1. build dataset (reruns until zero skipped rows; cache banks progress hourly)
#   2. retrain GBDT on the real dataset
#   3. export + validate public/model.onnx
#   4. restart the FastAPI service with the real model
cd "$(dirname "$0")/.."
for i in $(seq 1 24); do
  echo "[loop] build attempt $i"
  python scripts/build_landslide_dataset.py
  skipped=$(python -c "import json;print(json.load(open('ml-service/data/build_report.json')).get('skipped_no_features',999))" 2>/dev/null || echo 999)
  echo "[loop] skipped_no_features=$skipped"
  if [ "$skipped" = "0" ]; then
    echo "[loop] dataset COMPLETE — retraining GBDT"
    cd ml-service && python -m app.train_model || exit 1
    echo "[loop] training done — exporting ONNX"
    python ../scripts/export_onnx.py || exit 1
    echo "[loop] ONNX exported — restarting FastAPI"
    taskkill //F //FI "IMAGENAME eq python.exe" >/dev/null 2>&1
    sleep 2
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../.freebuff/fastapi.log 2>&1 &
    echo "[loop] PIPELINE COMPLETE — real-data model trained, exported, and serving"
    exit 0
  fi
  echo "[loop] waiting 5 min for quota window..."
  sleep 300
done
echo "[loop] exhausted attempts"
exit 1
