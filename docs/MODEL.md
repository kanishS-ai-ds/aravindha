# ARAVINDHA — AI/ML Predictive Model Documentation

## Model Overview
The predictive analytics engine replaces provisional weighted heuristics with a trained **Gradient Boosting Classifier (GBDT)** model specifically parameterized for the North Eastern Region (NER) of India.

## Feature Input Vector
The model accepts 8 spatial and meteorological features:
1. `lat`: Latitude (Bounding Box: 21.5°N - 29.5°N)
2. `lon`: Longitude (Bounding Box: 87.5°E - 97.5°E)
3. `rainfall_mm`: 24-hour cumulative monsoon rainfall in mm (Range: 0 - 400mm)
4. `soil_moisture`: Soil moisture saturation percentage (Range: 0 - 100%)
5. `landslide_history_count`: Historical NASA COOLR landslide event count in 10km radius
6. `elevation`: Elevation in meters (Range: 100m - 3500m)
7. `slope`: Terrain slope gradient in degrees (Range: 5° - 65°)
8. `recent_seismic_activity`: Max earthquake magnitude in last 7 days

## Output Classes & Scoring
- **0 (LOW Risk)**: 0 - 24 Risk Index
- **1 (MODERATE Risk)**: 25 - 49 Risk Index
- **2 (HIGH Risk)**: 50 - 74 Risk Index
- **3 (SEVERE Risk)**: 75 - 100 Risk Index

## Training & Retraining
To retrain the model with updated field ground truth data:

```bash
cd ml-service
python app/train_model.py
```

The script trains a new scikit-learn pipeline (StandardScaler + GradientBoostingClassifier) and updates `ml-service/app/model.joblib`.
