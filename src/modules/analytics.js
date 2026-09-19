/**
 * ARAVINDHA Dashboard — Analytics & AI/ML Predictive Engine Module
 * Wires the analytics cards to the REAL trained model (Option A):
 *   - prediction via ml-client (browser ONNX → FastAPI → heuristic)
 *   - model provenance (metrics, version) via FastAPI /model-info
 */

import { predictRiskLevel } from './ml-client.js';

const ML_API = 'http://localhost:8000';

export function initAnalytics() {
  fetchLatestMLPredictions();
  setInterval(fetchLatestMLPredictions, 60000);
  fetchModelInfo();
}

/** Fetch training metadata (dataset size, AUC, version) for the badge. */
export async function fetchModelInfo() {
  try {
    const res = await fetch(`${ML_API}/model-info`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const meta = await res.json();
    const badge = document.getElementById('mlModelBadge');
    if (badge && meta.auc_roc) {
      const data = meta.trained_on_real_data ? 'real COOLR inventory' : 'synthetic data';
      badge.innerHTML = `🤖 GBDT · ${data} · ${meta.positives}+/${meta.negatives}− · AUC ${meta.auc_roc} · ${meta.model_version}`;
      badge.title = `Trained: ${meta.rows} samples, test AUC-ROC ${meta.auc_roc}, Brier ${meta.brier}. Features: ${(meta.features || []).join(', ')}`;
    }
    return meta;
  } catch {
    return null;
  }
}

/** Live prediction from the real model pipeline (browser-first). */
export async function fetchLatestMLPredictions() {
  try {
    // Representative NER monsoon conditions; per-location scores come from
    // the 3D cockpit's handleCustomLocationSelected (fused into the donut).
    const result = await predictRiskLevel({
      rain_1d: 128, rain_3d: 282, rain_7d: 461, rain_15d: 640,
      rain_max_7d: 128, elevation_m: 1650, slope_deg: 34,
    });

    updateMLRiskCards({
      risk_level: result.riskLevel,
      risk_score: result.riskScore,
      confidence: Math.max(0.5, Math.abs(result.probability - 0.5) * 2),
      factors: [],
      _source: result.source,
    });
  } catch (err) {
    console.warn('[Analytics Module] ML prediction unavailable:', err.message);
  }
}

function updateMLRiskCards(latestPrediction) {
  // 1. Update overall risk status badge
  const riskStatusValue = document.querySelector('#riskStatusValue');
  const riskStatusText = document.querySelector('#riskStatusText');

  if (riskStatusValue) {
    riskStatusValue.textContent = latestPrediction.risk_level || 'MONITORING';
    riskStatusValue.style.color = getLevelColor(latestPrediction.risk_level);
  }

  if (riskStatusText) {
    riskStatusText.textContent = `AI/ML Model Confidence: ${(latestPrediction.confidence * 100).toFixed(0)}%`;
  }

  // 2. Update Risk Circle/Card if present
  const scoreElement = document.querySelector('#landslideRiskScore');
  const levelElement = document.querySelector('#landslideRiskLevel');

  if (scoreElement) {
    scoreElement.textContent = `${latestPrediction.risk_score}`;
  }

  if (levelElement) {
    levelElement.textContent = `${latestPrediction.risk_level} (ML)`;
  }

  const messageElement = document.querySelector('#riskMessage');
  if (messageElement) {
    const src = latestPrediction._source;
    messageElement.textContent =
      src === 'onnx-browser' ? 'Gradient Boosting Model (trained on NASA COOLR landslide inventory) scoring live in your browser.'
      : src === 'fastapi' ? 'Gradient Boosting Model (trained on NASA COOLR landslide inventory) via FastAPI service.'
      : 'Running calibrated local heuristic — start the ML service for full model inference.';
  }

  // 3. Render model badge in analytics section
  renderMLContributingFactors(latestPrediction);
}

function renderMLContributingFactors(latestPrediction) {
  const riskFactorsBox = document.querySelector('.risk-factors');
  if (!riskFactorsBox) return;

  let mlBadge = document.getElementById('mlModelBadge');
  if (!mlBadge) {
    mlBadge = document.createElement('div');
    mlBadge.id = 'mlModelBadge';
    mlBadge.className = 'ml-badge';
    mlBadge.innerHTML = '🤖 Powered by Real-Data GBDT (NASA COOLR + Open-Meteo)';
    riskFactorsBox.parentNode.insertBefore(mlBadge, riskFactorsBox);
  }
}

function getLevelColor(level) {
  switch (level) {
    case 'SEVERE': return '#ff0055';
    case 'HIGH': return '#ff9900';
    case 'MODERATE': return '#ffcc00';
    default: return '#38b000';
  }
}
