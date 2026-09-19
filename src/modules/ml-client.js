/**
 * ARAVINDHA — Frontend ML client (Option A + B).
 *
 * Priority order for P(landslide | conditions):
 *   1. In-browser ONNX inference (public/model.onnx via onnxruntime-web) — works offline
 *   2. FastAPI real-data service POST /predict (:8000)
 *   3. Local calibrated heuristic (rain-antecedent + slope logistic) — always available
 *
 * Also exposes quickHeuristic() for code paths that need a synchronous value.
 */

let ortSessionPromise = null;
let onnxBroken = false;

const FEATURES = [
  'rain_1d', 'rain_3d', 'rain_7d', 'rain_15d', 'rain_max_7d',
  'elevation_m', 'slope_deg', 'month_sin', 'month_cos',
];

function monthFeatures(month) {
  const m = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  return { month_sin: Math.sin((2 * Math.PI * m) / 12), month_cos: Math.cos((2 * Math.PI * m) / 12) };
}

/** Synchronous calibrated logistic — mirrors the real model's signal. */
export function quickHeuristic(f) {
  const sat = Math.max(0, Math.min(1, (f.rain_15d || 0) / 900));
  const burst = Math.max(0, Math.min(1, (f.rain_1d || 0) / 350));
  const slopeT = Math.max(0, Math.min(1, Math.max(0, (f.slope_deg ?? 15) - 8) / 50));
  const z = -4.2 + 2.6 * sat + 2.2 * burst + 1.9 * slopeT;
  return 1 / (1 + Math.exp(-z));
}

async function getOrt() {
  if (onnxBroken) return null;
  if (!ortSessionPromise) {
    ortSessionPromise = (async () => {
      try {
        const ort = await import('onnxruntime-web');
        ort.env.wasm.numThreads = 1; // file:// and cross-origin isolation safe
        ort.env.wasm.wasmPaths = new URL('ort/', document.baseURI).href;
        return await ort.InferenceSession.create('model.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      } catch (e) {
        console.warn('[ML] ONNX unavailable, using API/heuristic fallback:', e?.message);
        onnxBroken = true;
        return null;
      }
    })();
  }
  return ortSessionPromise;
}

/** Main API: real-data probability for a location + rainfall conditions. */
export async function predictLandslideProbability(features) {
  const f = {
    rain_1d: features.rain_1d ?? 0,
    rain_3d: features.rain_3d ?? (features.rain_1d ?? 0) * 2.2,
    rain_7d: features.rain_7d ?? (features.rain_1d ?? 0) * 3.6,
    rain_15d: features.rain_15d ?? (features.rain_1d ?? 0) * 5,
    rain_max_7d: features.rain_max_7d ?? features.rain_1d ?? 0,
    elevation_m: features.elevation_m ?? features.elevation ?? 500,
    slope_deg: features.slope_deg ?? features.slope ?? 15,
    ...monthFeatures(features.month),
  };

  // 1) In-browser ONNX (real-data GBDT, converted)
  try {
    const ort = await import('onnxruntime-web'); // cached after first load; provides .Tensor
    const session = await getOrt();
    if (session) {
      const input = new ort.Tensor('float32',
        Float32Array.from(FEATURES.map((k) => f[k])), [1, FEATURES.length]);
      const res = await session.run({ input });
      // skl2onnx emits outputs named 'label' (int64) + 'probabilities' (float32 [1,2]);
      // pick the float tensor defensively instead of assuming a name.
      const probsName = session.outputNames.find((n) => {
        const t = res[n];
        return t && t.type === 'float32' && t.data && t.data.length >= 1;
      }) || session.outputNames[session.outputNames.length - 1];
      const t = res[probsName];
      const prob = t.data.length === 1 ? t.data[0] : t.data[t.data.length - 1];
      if (!Number.isFinite(prob)) throw new Error('ONNX returned non-finite probability');
      return { probability: prob, source: 'onnx-browser', model: 'GBDT real-data (browser)' };
    }
  } catch (e) {
    console.warn('[ML] ONNX inference unavailable this call, using API/heuristic fallback:', e?.message || e);
    onnxBroken = true; // stop retrying every call after a hard failure
    ortSessionPromise = null;
  }

  // 2) FastAPI real-data service
  try {
    const res = await fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const j = await res.json();
      return { probability: j.probability, source: 'fastapi', model: j.model_version };
    }
  } catch { /* fall through */ }

  // 3) Calibrated local heuristic
  return {
    probability: quickHeuristic(f),
    source: 'heuristic',
    model: 'logistic-antecedent-v1',
  };
}

/** Legacy-compatible: 4-level dashboard score from the same pipeline. */
export async function predictRiskLevel(features) {
  const r = await predictLandslideProbability(features);
  const score = Math.round(Math.max(0, Math.min(100, r.probability * 100)));
  const level = score >= 75 ? 'SEVERE' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW';
  return { ...r, riskScore: score, riskLevel: level };
}
