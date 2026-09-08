/**
 * ARAVINDHA Dashboard — Analytics & AI/ML Predictive Engine Module
 * Replaces provisional formula score with live ML microservice output
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:4000/api'
  : '/api';

export function initAnalytics() {
  fetchLatestMLPredictions();
  setInterval(fetchLatestMLPredictions, 15000);
}

export async function fetchLatestMLPredictions() {
  try {
    const res = await fetch(`${API_BASE}/risk-scores/latest`);
    if (!res.ok) return;
    const scores = await res.json();
    if (scores && scores.length > 0) {
      updateMLRiskCards(scores[0]);
    }
  } catch (err) {
    console.warn('[Analytics Module] Could not connect to ML backend:', err.message);
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
  const messageElement = document.querySelector('#riskMessage');

  if (scoreElement) {
    scoreElement.textContent = `${latestPrediction.risk_score}`;
  }

  if (levelElement) {
    levelElement.textContent = `${latestPrediction.risk_level} (ML)`;
  }

  if (messageElement && latestPrediction.factors) {
    const mainFactor = latestPrediction.factors[0];
    messageElement.textContent = `Gradient Boosting Model: Primary contributor is ${mainFactor ? mainFactor.factor + ' (' + mainFactor.value + ')' : 'Terrain baseline'}.`;
  }

  // 3. Render Contributing Factors list in analytics section
  renderMLContributingFactors(latestPrediction.factors);
}

function renderMLContributingFactors(factors) {
  if (!factors || !Array.isArray(factors)) return;

  const riskFactorsBox = document.querySelector('.risk-factors');
  if (!riskFactorsBox) return;

  // Add AI Model badge if not already added
  let mlBadge = document.getElementById('mlModelBadge');
  if (!mlBadge) {
    mlBadge = document.createElement('div');
    mlBadge.id = 'mlModelBadge';
    mlBadge.className = 'ml-badge';
    mlBadge.innerHTML = '🤖 Powered by FastAPI ML Engine (Scikit-Learn GBDT)';
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
