import os
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional

app = FastAPI(
    title="ARAVINDHA Predictive Analytics Engine",
    description="AI/ML Risk Assessment Microservice for North Eastern Region India",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.joblib')
model_pipeline = None

class RiskPredictionRequest(BaseModel):
    lat: float = Field(..., description="Latitude (NER bounding box: 21.5 - 29.5)")
    lon: float = Field(..., description="Longitude (NER bounding box: 87.5 - 97.5)")
    rainfall_mm: float = Field(..., description="24-hour cumulative rainfall in mm")
    soil_moisture: float = Field(..., description="Soil moisture saturation percentage (0-100)")
    landslide_history_count: int = Field(..., description="Historical landslide events count in 10km radius")
    elevation: Optional[float] = Field(500.0, description="Elevation in meters")
    slope: Optional[float] = Field(25.0, description="Slope angle in degrees")
    recent_seismic_activity: Optional[float] = Field(0.0, description="Max seismic magnitude in last 7 days")

class ContributingFactor(BaseModel):
    factor: str
    impact: str # "HIGH", "MODERATE", "LOW"
    value: str

class RiskPredictionResponse(BaseModel):
    risk_score: int # 0 - 100
    risk_level: str # LOW, MODERATE, HIGH, SEVERE
    confidence: float # 0.0 - 1.0
    contributing_factors: List[ContributingFactor]
    model_version: str

def load_or_train_model():
    global model_pipeline
    if os.path.exists(MODEL_PATH):
        try:
            model_pipeline = joblib.load(MODEL_PATH)
            print("ML model loaded successfully.")
            return
        except Exception as e:
            print(f"Error loading model: {e}. Retraining...")
    
    # Train inline if model not found
    from app.train_model import train_and_save
    train_and_save()
    model_pipeline = joblib.load(MODEL_PATH)

@app.on_event("startup")
def startup_event():
    load_or_train_model()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "aravindha-ml-engine",
        "model_loaded": model_pipeline is not None
    }

LEVEL_MAP = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "SEVERE"}

@app.post("/predict-risk", response_model=RiskPredictionResponse)
def predict_risk(payload: RiskPredictionRequest):
    if model_pipeline is None:
        load_or_train_model()
    
    features = np.array([[
        payload.lat,
        payload.lon,
        payload.rainfall_mm,
        payload.soil_moisture,
        payload.landslide_history_count,
        payload.elevation if payload.elevation is not None else 500.0,
        payload.slope if payload.slope is not None else 25.0,
        payload.recent_seismic_activity if payload.recent_seismic_activity is not None else 0.0
    ]])
    
    try:
        probabilities = model_pipeline.predict_proba(features)[0]
        predicted_class = int(np.argmax(probabilities))
        confidence = round(float(probabilities[predicted_class]), 3)
        
        # Calculate continuous risk score (0-100) based on class probabilities
        # Class weights: LOW (0-24), MODERATE (25-49), HIGH (50-74), SEVERE (75-100)
        class_weights = np.array([12.5, 37.5, 62.5, 87.5])
        base_score = float(np.dot(probabilities, class_weights))
        
        # Micro-adjustment based on extreme rainfall & slope inputs
        rainfall_boost = min(15.0, (payload.rainfall_mm / 300.0) * 15.0)
        slope_boost = min(10.0, (payload.slope / 60.0) * 10.0)
        
        final_score = int(round(np.clip(base_score + (rainfall_boost * 0.4) + (slope_boost * 0.3), 0, 100)))
        
        if final_score < 25:
            risk_level = "LOW"
        elif final_score < 50:
            risk_level = "MODERATE"
        elif final_score < 75:
            risk_level = "HIGH"
        else:
            risk_level = "SEVERE"
            
        factors = []
        if payload.rainfall_mm > 50:
            factors.append(ContributingFactor(
                factor="Heavy Monsoon Rainfall",
                impact="HIGH" if payload.rainfall_mm > 150 else "MODERATE",
                value=f"{payload.rainfall_mm:.1f} mm/24h"
            ))
        if payload.slope > 30:
            factors.append(ContributingFactor(
                factor="Steep Slope Gradient",
                impact="HIGH" if payload.slope > 45 else "MODERATE",
                value=f"{payload.slope:.1f}°"
            ))
        if payload.soil_moisture > 75:
            factors.append(ContributingFactor(
                factor="High Soil Saturation",
                impact="HIGH" if payload.soil_moisture > 88 else "MODERATE",
                value=f"{payload.soil_moisture:.1f}%"
            ))
        if payload.landslide_history_count > 5:
            factors.append(ContributingFactor(
                factor="Historical Landslide Cluster",
                impact="HIGH" if payload.landslide_history_count > 15 else "MODERATE",
                value=f"{payload.landslide_history_count} past events"
            ))
        if payload.recent_seismic_activity > 2.5:
            factors.append(ContributingFactor(
                factor="Recent Seismic Tremor",
                impact="HIGH" if payload.recent_seismic_activity > 4.5 else "MODERATE",
                value=f"M{payload.recent_seismic_activity:.1f}"
            ))
            
        if not factors:
            factors.append(ContributingFactor(
                factor="Normal Meteorological Baseline",
                impact="LOW",
                value="Stable terrain condition"
            ))
            
        return RiskPredictionResponse(
            risk_score=final_score,
            risk_level=risk_level,
            confidence=confidence,
            contributing_factors=factors,
            model_version="v1.2.0-GradientBoosting-NER"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")
