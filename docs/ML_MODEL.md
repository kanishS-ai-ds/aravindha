# ARAVINDHA — Real-Data Landslide ML Model (Option A + B)

## What this is

A **Gradient Boosting Classifier trained on real historical landslide data**, replacing
the previous synthetic-data model. It is served two ways:

1. **FastAPI microservice** (`ml-service/`, port 8000) — `/predict`, `/predict-risk`, `/model-info`
2. **In-browser ONNX** (`public/model.onnx` via onnxruntime-web) — zero-backend inference,
   tried first by the frontend; FastAPI and a local heuristic are the fallbacks.

The trained probability is **fused into the ensemble risk score** at the same 45% ML
weight as before — but now the ML term is a genuinely learned model, not a hand-written
weighted sum.

## Data sources (all real, all free, no API keys)

| Source | What it provides | Endpoint |
|---|---|---|
| NASA COOLR global landslide inventory | ~2,438 India-region landslide events 2007–2024 (position + date) | `ml-service/data/coolr_raw.csv` (mirror of data.nasa.gov `tjff-iytn`) |
| NASA POWER (primary) | Satellite-era daily precipitation → antecedent rainfall per point (no key, no quota wall) | power.larc.nasa.gov/api/temporal/daily/point |
| Open-Meteo Era5 Archive (secondary) | Batched daily precipitation when its hourly quota is open | archive-api.open-meteo.com |
| Open-Meteo Elevation | DEM elevation at 5 samples/point → elevation + slope | api.open-meteo.com/v1/elevation |

## Features (9, in fixed order)

```
rain_1d, rain_3d, rain_7d, rain_15d, rain_max_7d,   # antecedent rainfall (mm)
elevation_m, slope_deg,                              # terrain
month_sin, month_cos                                 # seasonality (monsoon cycle)
```

Negatives are random location/date pairs **>11 km from any cataloged event**,
monsoon-weighted, at a 2:1 negative:positive ratio.

## Pipeline

```
scripts/fetch_coolr.sh                    # (optional) retry-fetch the catalog
scripts/build_landslide_dataset.py        # COOLR + Open-Meteo → ml-service/data/landslide_dataset.csv
python -m app.train_model                 # (in ml-service/) trains GBDT → app/model.joblib + model_meta.json
python ../scripts/export_onnx.py          # sklearn → public/model.onnx + validation
uvicorn app.main:app --port 8000          # serve
```

Every API response is cached in `ml-service/data/.cache/` — the dataset build is
**resume-safe** and re-runs cost nothing after the first build. Rainfall uses a
**hybrid fetch**: Open-Meteo year-batches first (cheap when its hourly quota is
open; a tiny probe call decides instantly), then NASA POWER per-point 16-day
windows mop up the rest — so the build never stalls on either provider.

To run the whole pipeline unattended (build → retry on quota → train → export
ONNX → restart API):

```bash
nohup bash scripts/build_dataset_loop.sh > .freebuff/dataset-build.log 2>&1 &
```

It exits after printing `PIPELINE COMPLETE` when `skipped_no_features = 0`.

## Honest evaluation (hold-out 22%)

Metrics land in `ml-service/app/model_meta.json` and surface in the UI badge via
`/model-info`: **AUC-ROC, average precision, Brier score, class balance**. The badge
always states whether the model was trained on real data.

### FINAL TRAINED MODEL (2026-09-18) ✅

| Metric | Value |
|---|---|
| Dataset | **7,314 rows — 2,438 real COOLR landslide events + 4,876 sampled non-events, 0 skipped** |
| AUC-ROC | **0.9685** |
| Average precision | 0.9354 |
| Brier score | 0.0612 |
| Model version | `v2.0.0-real-coolr-gbdt` |
| trained_on_real_data | **true** |

Exported + validated `public/model.onnx` (max abs error vs sklearn: 8.6e-08).
Rainfall features resolved 100% from real archived weather (Open-Meteo batched
archive API + NASA POWER per-point mop-up); elevations from the same sources;
slopes from 100 m DEM sampling where available, KNN plane-fit gradients elsewhere.

## Frontend wiring

- `src/modules/ml-client.js` — browser ONNX → FastAPI → heuristic fallback chain
- `src/modules/landslide-dashboard-ui.js` — map-click risk donut fuses the real model
  (45%) with physics FoS (55%); badge under the donut shows the active source
- `src/modules/analytics.js` — analytics cards + provenance badge from `/model-info`
- The legacy "RF/XGBoost surrogate" in `landslide-simulation-engine.js` is now only
  a fallback for synchronous callers

## Helper scripts

| Script | Purpose |
|---|---|
| `scripts/wait_and_build_dataset.sh` | Probes Open-Meteo until the hourly quota resets, then runs the dataset build unattended (logs to `.freebuff/dataset-build.log`) |
| `scripts/run_ml_service.bat` | Trains on first run if the model is missing, then serves on :8000 |
| `scripts/export_onnx.py` | Exports + validates `public/model.onnx` (max abs error vs sklearn < 1e-4) |

`public/ort/` holds the onnxruntime-web wasm + `.mjs` loader files locally, so
browser inference works without CDN access (verified live: `onnx-browser` source,
~3 ms per prediction, values identical to the FastAPI path).

## Status / next retrain

After any change to the dataset (or after the background build completes):

```bash
cd ml-service
python -m app.train_model        # retrain on real data (falls back to synthetic if CSV missing)
python ../scripts/export_onnx.py # refresh the browser model
# restart uvicorn to pick up the new model
```

`/health` and the UI badge show `trained_on_real_data: true` once the real dataset
was used. The build cache (`ml-service/data/.cache/`) is keyed by stable CRC32
hashes of the request params, so re-runs only fetch missing batches.
