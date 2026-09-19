#!/bin/bash
cd "$(dirname "$0")/.."
export OM_ELEV_DISABLED=1
python scripts/build_landslide_dataset.py
skipped=$(python -c "import json;print(json.load(open('ml-service/data/build_report.json')).get('skipped_no_features',999))")
echo "[final] skipped_no_features=$skipped"
if [ "$skipped" -le 400 ]; then
  echo "[final] training GBDT on real dataset"
  cd ml-service && python -m app.train_model || exit 1
  echo "[final] exporting ONNX"
  python ../scripts/export_onnx.py || exit 1
  echo "[final] restarting FastAPI"
  nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../.freebuff/fastapi.log 2>&1 &
  echo "[final] PIPELINE COMPLETE"
fi
