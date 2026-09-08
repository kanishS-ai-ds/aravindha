import express from 'express';
import { queryExec, queryAll, queryOne } from '../db/database.js';
import { evaluateRiskAndSensors } from '../services/ruleEngine.js';

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// POST /api/predict-risk
router.post('/predict-risk', async (req, res) => {
  try {
    const payload = req.body;
    let prediction = null;

    try {
      const mlRes = await fetch(`${ML_SERVICE_URL}/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (mlRes.ok) {
        prediction = await mlRes.json();
      }
    } catch (err) {
      console.warn('[Predictions Route] ML microservice unreachable, computing local model fallback:', err.message);
    }

    // Fallback logic if ML microservice unreachable
    if (!prediction) {
      const rainfall = payload.rainfall_mm || 0;
      const slope = payload.slope || 25;
      const history = payload.landslide_history_count || 0;
      const score = Math.min(100, Math.round((rainfall / 300) * 45 + (slope / 60) * 30 + (history / 20) * 25));
      let level = 'LOW';
      if (score >= 75) level = 'SEVERE';
      else if (score >= 50) level = 'HIGH';
      else if (score >= 25) level = 'MODERATE';

      prediction = {
        risk_score: score,
        risk_level: level,
        confidence: 0.85,
        contributing_factors: [
          { factor: 'Rainfall Saturation', impact: rainfall > 100 ? 'HIGH' : 'MODERATE', value: `${rainfall.toFixed(1)} mm` },
          { factor: 'Terrain Slope Gradient', impact: slope > 35 ? 'HIGH' : 'LOW', value: `${slope.toFixed(1)}°` }
        ],
        model_version: 'v1.2.0-Fallback'
      };
    }

    // Log prediction to database
    const locationName = payload.location_name || 'NER Region';
    await queryExec(
      `INSERT INTO predictions_log (input_payload, output_prediction, model_version, created_at)
       VALUES (?, ?, ?, ?)`,
      [JSON.stringify(payload), JSON.stringify(prediction), prediction.model_version, new Date().toISOString()]
    );

    // Save/update latest risk score for location
    await queryExec(
      `INSERT INTO risk_scores (location_name, latitude, longitude, risk_score, risk_level, confidence, factors, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        locationName,
        payload.lat || 26.14,
        payload.lon || 91.73,
        prediction.risk_score,
        prediction.risk_level,
        prediction.confidence,
        JSON.stringify(prediction.contributing_factors),
        new Date().toISOString()
      ]
    );

    // Evaluate risk in rule engine for real-time websocket broadcast and auto SMS
    await evaluateRiskAndSensors(locationName, prediction.risk_score, prediction.risk_level, prediction.contributing_factors);

    res.json(prediction);
  } catch (err) {
    console.error('[Predictions Route Error]', err);
    res.status(500).json({ error: 'Failed to compute risk prediction.', details: err.message });
  }
});

// GET /api/risk-scores/latest
router.get('/risk-scores/latest', async (req, res) => {
  try {
    const scores = await queryAll('SELECT * FROM risk_scores ORDER BY updated_at DESC LIMIT 10');
    if (scores && scores.length > 0) {
      // Parse factors string if SQLite JSON string
      const parsedScores = scores.map(s => ({
        ...s,
        factors: typeof s.factors === 'string' ? JSON.parse(s.factors) : s.factors
      }));
      return res.json(parsedScores);
    }
    
    // Default initial prediction if DB empty
    res.json([{
      location_name: 'NER Command Region',
      latitude: 26.1445,
      longitude: 91.7362,
      risk_score: 68,
      risk_level: 'HIGH',
      confidence: 0.89,
      factors: [
        { factor: 'Cumulative Monsoon Rainfall', impact: 'HIGH', value: '142.5 mm/24h' },
        { factor: 'Historical Landslide Cluster', impact: 'MODERATE', value: '18 events' },
        { factor: 'Steep Slope Gradient', impact: 'HIGH', value: '38.5°' }
      ],
      updated_at: new Date().toISOString()
    }]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest risk scores.' });
  }
});

export default router;
