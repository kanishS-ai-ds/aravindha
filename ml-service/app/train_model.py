import os
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def generate_ner_synthetic_dataset(n_samples=2500):
    np.random.seed(42)
    
    # Feature generation aligned with NER geography
    # lat: 21.5 - 29.5 (NER bounding box)
    # lon: 87.5 - 97.5
    lat = np.random.uniform(21.5, 29.5, n_samples)
    lon = np.random.uniform(87.5, 97.5, n_samples)
    
    # elevation (meters): 100m to 3500m
    elevation = np.random.uniform(100, 3500, n_samples)
    
    # slope (degrees): 5 to 65
    slope = np.random.uniform(5, 65, n_samples)
    
    # rainfall_mm (24h cumulative): 0 to 400 mm (Cherrapunji/Mawsynram extreme monsoons)
    rainfall_mm = np.random.uniform(0, 400, n_samples)
    
    # soil_moisture (%): 10 to 98
    soil_moisture = np.random.uniform(10, 98, n_samples)
    
    # landslide_history_count (nearby historical events): 0 to 45
    landslide_history_count = np.random.poisson(lam=5, size=n_samples)
    
    # recent_seismic_activity (magnitude 0 to 6.5)
    recent_seismic_activity = np.random.exponential(scale=0.8, size=n_samples)
    
    # Target label hazard index calculation
    # Weighted hazard score formula to generate realistic binary/multiclass ground truth
    hazard_score = (
        (slope / 65.0) * 0.30 +
        (rainfall_mm / 400.0) * 0.35 +
        (soil_moisture / 100.0) * 0.15 +
        (np.minimum(landslide_history_count, 30) / 30.0) * 0.12 +
        (np.minimum(recent_seismic_activity, 6.0) / 6.0) * 0.08
    ) + np.random.normal(0, 0.05, n_samples)
    
    # Standard thresholding: 0=Low, 1=Moderate, 2=High, 3=Severe
    labels = np.zeros(n_samples, dtype=int)
    labels[hazard_score >= 0.30] = 1 # Moderate
    labels[hazard_score >= 0.52] = 2 # High
    labels[hazard_score >= 0.70] = 3 # Severe
    
    X = np.column_stack([
        lat, lon, rainfall_mm, soil_moisture,
        landslide_history_count, elevation, slope, recent_seismic_activity
    ])
    
    return X, labels

def train_and_save():
    print("Generating synthetic NER disaster dataset...")
    X, y = generate_ner_synthetic_dataset()
    
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42))
    ])
    
    print("Training Gradient Boosting Landslide Risk Classifier...")
    pipeline.fit(X, y)
    
    model_dir = os.path.dirname(__file__)
    model_path = os.path.join(model_dir, 'model.joblib')
    joblib.dump(pipeline, model_path)
    print(f"Model successfully saved to {model_path}")

if __name__ == '__main__':
    train_and_save()
