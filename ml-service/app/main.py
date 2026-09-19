import os
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional

app = FastAPI(
    title="ARAVINDHA Predictive Analytics Engine",
    description="Real-data landslide probability model (COOLR inventory + Open-Meteo features)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.joblib')
META_PATH = os.path.join(os.path.dirname(__file__), 'model_meta.json')
model_pipeline = None
model_meta = {}


class PredictRequest(BaseModel):
    """Feature-based prediction — matches train_model.FEATURES order."""
    rain_1d: float = Field(0.0, description="Rainfall, last 1 day (mm)")
    rain_3d: float = Field(0.0, description="Rainfall, last 3 days cumulative (mm)")
    rain_7d: float = Field(0.0, description="Rainfall, last 7 days cumulative (mm)")
    rain_15d: float = Field(0.0, description="Rainfall, last 15 days cumulative (mm)")
    rain_max_7d: float = Field(0.0, description="Max single-day rainfall in last 7 days (mm)")
    elevation_m: float = Field(500.0, description="Elevation (m)")
    slope_deg: float = Field(15.0, description="Slope angle (degrees)")
    month: Optional[int] = Field(None, description="Month 1-12; derives seasonality")


class PredictResponse(BaseModel):
    probability: float          # P(landslide | conditions) 0-1
    risk_score: int             # 0-100
    risk_level: str             # LOW / MODERATE / HIGH / SEVERE
    confidence: float
    model_version: str
    trained_on_real_data: bool


class ContributingFactor(BaseModel):
    factor: str
    impact: str
    value: str


class RiskPredictionResponse(BaseModel):
    risk_score: int
    risk_level: str
    confidence: float
    contributing_factors: List[ContributingFactor]
    model_version: str


def load_or_train_model():
    global model_pipeline, model_meta
    if os.path.exists(MODEL_PATH):
        try:
            model_pipeline = joblib.load(MODEL_PATH)
            if os.path.exists(META_PATH):
                import json
                with open(META_PATH, "r", encoding="utf-8") as f:
                    model_meta = json.load(f)
            print("ML model loaded successfully.")
            return
        except Exception as e:
            print(f"Error loading model: {e}. Retraining...")
    from app.train_model import train_and_save
    train_and_save()
    model_pipeline = joblib.load(MODEL_PATH)
    import json
    with open(META_PATH, "r", encoding="utf-8") as f:
        model_meta = json.load(f)


@app.on_event("startup")
def startup_event():
    load_or_train_model()


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "aravindha-ml-engine",
        "model_loaded": model_pipeline is not None,
        "model_version": model_meta.get("model_version"),
        "trained_on_real_data": model_meta.get("trained_on_real_data", False),
        "auc_roc": model_meta.get("auc_roc"),
    }


@app.get("/model-info")
def model_info():
    """Training metadata: dataset size, metrics, feature list."""
    if not model_meta:
        load_or_train_model()
    return model_meta


def _month_features(month):
    m = month if month and 1 <= month <= 12 else 7
    return float(np.sin(2 * np.pi * m / 12)), float(np.cos(2 * np.pi * m / 12))


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    """Raw real-data model probability. Feature order MUST match training."""
    if model_pipeline is None:
        load_or_train_model()
    msin, mcos = _month_features(payload.month)
    x = np.array([[
        payload.rain_1d, payload.rain_3d, payload.rain_7d, payload.rain_15d,
        payload.rain_max_7d, payload.elevation_m, payload.slope_deg, msin, mcos,
    ]])
    try:
        p = float(model_pipeline.predict_proba(x)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")
    score = int(round(np.clip(p * 100, 0, 100)))
    level = ("SEVERE" if score >= 75 else "HIGH" if score >= 50
             else "MODERATE" if score >= 25 else "LOW")
    return PredictResponse(
        probability=round(p, 4),
        risk_score=score,
        risk_level=level,
        confidence=round(abs(p - 0.5) * 2, 3),
        model_version=model_meta.get("model_version", "unknown"),
        trained_on_real_data=bool(model_meta.get("trained_on_real_data", False)),
    )


# Legacy 4-class endpoint kept for compatibility with the dashboard polling path
LEVEL_MAP = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "SEVERE"}


@app.post("/predict-risk", response_model=RiskPredictionResponse)
def predict_risk(payload: dict):
    """Legacy shape: accepts the old NER payload or the new features and
    returns the dashboard's expected response with contributing factors."""
    if model_pipeline is None:
        load_or_train_model()

    def g(key, default):
        v = payload.get(key, default)
        try:
            return float(v)
        except (TypeError, ValueError):
            return float(default)

    rain_1d = g("rain_1d", g("rainfall_mm", 0))
    rain_3d = g("rain_3d", rain_1d * 2.2)
    rain_7d = g("rain_7d", rain_1d * 3.6)
    rain_15d = g("rain_15d", rain_1d * 5.0)
    rain_max_7d = g("rain_max_7d", rain_1d)
    elevation = g("elevation_m", g("elevation", 500))
    slope = g("slope_deg", g("slope", 15))
    month = int(payload.get("month") or 7)
    msin, mcos = _month_features(month)

    x = np.array([[rain_1d, rain_3d, rain_7d, rain_15d, rain_max_7d,
                   elevation, slope, msin, mcos]])
    try:
        p = float(model_pipeline.predict_proba(x)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    final_score = int(round(np.clip(p * 100, 0, 100)))
    if final_score < 25:
        risk_level = "LOW"
    elif final_score < 50:
        risk_level = "MODERATE"
    elif final_score < 75:
        risk_level = "HIGH"
    else:
        risk_level = "SEVERE"

    factors = []
    if rain_1d > 50:
        factors.append(ContributingFactor(
            factor="Heavy Rainfall",
            impact="HIGH" if rain_1d > 150 else "MODERATE",
            value=f"{rain_1d:.1f} mm/24h"))
    if rain_15d > 300:
        factors.append(ContributingFactor(
            factor="Saturated Antecedent Conditions",
            impact="HIGH" if rain_15d > 600 else "MODERATE",
            value=f"{rain_15d:.0f} mm/15d"))
    if slope > 30:
        factors.append(ContributingFactor(
            factor="Steep Slope Gradient",
            impact="HIGH" if slope > 45 else "MODERATE",
            value=f"{slope:.1f}°"))
    if elevation > 2000:
        factors.append(ContributingFactor(
            factor="High-Relief Himalayan Terrain",
            impact="MODERATE",
            value=f"{elevation:.0f} m"))

    if not factors:
        factors.append(ContributingFactor(
            factor="Normal Meteorological Baseline",
            impact="LOW",
            value="Stable terrain condition"))

    return RiskPredictionResponse(
        risk_score=final_score,
        risk_level=risk_level,
        confidence=round(abs(p - 0.5) * 2, 3),
        contributing_factors=factors,
        model_version=model_meta.get("model_version", "unknown"),
    )
