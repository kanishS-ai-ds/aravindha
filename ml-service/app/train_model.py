"""
ARAVINDHA — Landslide model trainer (Option A: real-data GBDT).

Trains a GradientBoostingClassifier on the real dataset produced by
scripts/build_landslide_dataset.py (NASA COOLR inventory points + Open-Meteo
antecedent rainfall + elevation/slope), evaluates it honestly (AUC / Brier on
a held-out split), and saves:

  app/model.joblib      sklearn Pipeline (StandardScaler + GradientBoostingClassifier)
  app/model_meta.json   metrics, feature list, thresholds, class balance

Falls back to the legacy synthetic dataset ONLY if the real dataset file is
missing, so the service can always boot.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
REAL_DATA = os.path.normpath(os.path.join(HERE, "..", "data", "landslide_dataset.csv"))
MODEL_PATH = os.path.join(HERE, "model.joblib")
META_PATH = os.path.join(HERE, "model_meta.json")

# Ordered feature vector — MUST match the frontend/ONNX payload order
FEATURES = [
    "rain_1d", "rain_3d", "rain_7d", "rain_15d", "rain_max_7d",
    "elevation_m", "slope_deg", "month_sin", "month_cos",
]
MODEL_VERSION = "v2.0.0-real-coolr-gbdt"


def _load_real():
    if not os.path.exists(REAL_DATA):
        return None
    df = pd.read_csv(REAL_DATA)
    df = df.dropna(subset=FEATURES + ["label"])
    # guard: keep the label balance sane (positives must dominate the tail)
    y = df["label"].astype(int).values
    if len(df) < 200 or y.sum() < 80:
        print(f"Real dataset too small ({len(df)} rows, {int(y.sum())} pos) — falling back.")
        return None
    X = df[FEATURES].astype(float).values
    print(f"Real dataset: {len(df)} rows | positives {int(y.sum())} | negatives {int((1 - y).sum())}")
    return X, y


def _synthetic_fallback(n=2500):
    """Legacy synthetic generator — emergency fallback only."""
    rng = np.random.default_rng(42)
    X = np.column_stack([
        rng.uniform(0, 400, n), rng.uniform(0, 500, n), rng.uniform(0, 700, n),
        rng.uniform(0, 1000, n), rng.uniform(0, 400, n),
        rng.uniform(50, 4500, n), rng.uniform(2, 65, n),
        np.sin(2 * np.pi * rng.integers(1, 13, n) / 12),
        np.cos(2 * np.pi * rng.integers(1, 13, n) / 12),
    ])
    score = ((X[:, 3] / 1000) * 0.42 + (X[:, 6] / 65) * 0.33
             + (X[:, 0] / 400) * 0.25 + rng.normal(0, 0.04, n))
    y = (score > 0.52).astype(int)
    print(f"SYNTHETIC fallback dataset: {n} rows | positives {int(y.sum())}")
    return X, y


def train_and_save():
    data = _load_real() or _synthetic_fallback()
    X, y = data
    real = os.path.exists(REAL_DATA)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.22, stratify=y, random_state=42)

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", GradientBoostingClassifier(
            n_estimators=300, max_depth=3, learning_rate=0.06,
            subsample=0.9, random_state=42)),
    ])
    print("Training GradientBoostingClassifier...")
    pipe.fit(X_tr, y_tr)

    p_te = pipe.predict_proba(X_te)[:, 1]
    metrics = {
        "rows": int(len(y)),
        "positives": int(y.sum()),
        "negatives": int((1 - y).sum()),
        "test_rows": int(len(y_te)),
        "auc_roc": round(float(roc_auc_score(y_te, p_te)), 4),
        "average_precision": round(float(average_precision_score(y_te, p_te)), 4),
        "brier": round(float(brier_score_loss(y_te, p_te)), 4),
        "base_rate": round(float(y_te.mean()), 4),
        "trained_on_real_data": bool(real),
        "model_version": MODEL_VERSION,
        "features": FEATURES,
    }
    print(json.dumps(metrics, indent=2))

    joblib.dump(pipe, MODEL_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved {MODEL_PATH} and {META_PATH}")
    return metrics


if __name__ == "__main__":
    train_and_save()
