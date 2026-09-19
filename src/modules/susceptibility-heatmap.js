/**
 * ARAVINDHA — ML susceptibility heatmap layer.
 *
 * Replaces the old decorative radial-gradient "demo" heatmap with a real,
 * data-driven susceptibility surface:
 *   1. Real DEM grid (AWS Terrain Tiles / terrarium) for the view bounds
 *   2. Per-cell slope derived from the elevation surface
 *   3. Live antecedent rainfall (Open-Meteo, past 14 days) at the view centre
 *   4. Every cell scored through the TRAINED GradientBoosting model
 *      (in-browser ONNX → FastAPI → calibrated heuristic fallback)
 *   5. Probabilities normalized + colorized (blue → amber → red risk ramp)
 *      and returned as a canvas ready for a MapLibre image source drape.
 */

import { fetchElevationGrid } from './video-studio-terrain.js';
import { predictBatchLandslideProbability } from './ml-client.js';

/** Build a bbox around a centre point. */
export function bboxAround(lat, lon, spanLat, spanLon) {
  return {
    minLat: lat - spanLat / 2,
    maxLat: lat + spanLat / 2,
    minLon: lon - spanLon / 2,
    maxLon: lon + spanLon / 2,
  };
}

/** Live antecedent rainfall (mm) from Open-Meteo past-14-day daily series. */
export async function fetchLiveRainfall(lat, lon) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}` +
      `&longitude=${lon.toFixed(4)}&daily=precipitation_sum&past_days=14` +
      `&forecast_days=1&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const j = await res.json();
      const series = (j.daily && j.daily.precipitation_sum || []).filter((v) => v != null);
      if (series.length) {
        const s = series.slice(-14);
        const sum = (n) => s.slice(-n).reduce((a, b) => a + b, 0);
        return {
          rain_1d: sum(1),
          rain_3d: sum(3),
          rain_7d: sum(7),
          rain_15d: sum(14),
          rain_max_7d: Math.max(...s.slice(-7)),
          source: 'open-meteo-live',
        };
      }
    }
  } catch { /* fall through to monsoon climatology */ }
  return null;
}

/** Per-cell slope (degrees) via central differences on the DEM grid. */
function slopesFromDem(heights, res, cellXm, cellYm) {
  const slopes = new Float32Array(res * res);
  for (let gy = 0; gy < res; gy++) {
    for (let gx = 0; gx < res; gx++) {
      const i = gy * res + gx;
      const xl = gx > 0 ? heights[i - 1] : heights[i];
      const xr = gx < res - 1 ? heights[i + 1] : heights[i];
      const yu = gy > 0 ? heights[i - res] : heights[i];
      const yd = gy < res - 1 ? heights[i + res] : heights[i];
      const dzdx = (xr - xl) / (2 * cellXm);
      const dzdy = (yd - yu) / (2 * cellYm);
      slopes[i] = Math.min(80, Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI));
    }
  }
  return slopes;
}

/* Risk color ramp: deep blue (stable) → teal → green → amber → red (critical) */
const RAMP = [
  [0.00, [26, 35, 82]],
  [0.18, [21, 101, 192]],
  [0.34, [0, 151, 167]],
  [0.48, [67, 160, 71]],
  [0.60, [253, 216, 53]],
  [0.74, [244, 143, 27]],
  [0.86, [229, 57, 53]],
  [1.00, [183, 28, 28]],
];

function rampColor(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const f = (x - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/**
 * Compute the susceptibility surface for a view box.
 * @returns {{ canvas, dem, probs, stats, rain }} canvas is square, ready to drape.
 */
export async function computeSusceptibilityHeatmap({
  lat, lon,
  spanLat = 0.075,
  spanLon = 0.090,
  res: resArg = 96,
  rain = null,
  month = null,
  onProgress,
} = {}) {
  let res = resArg;
  const bbox = bboxAround(lat, lon, spanLat, spanLon);

  // DEM tiles sometimes stall on flaky networks and decode as an all-void
  // (flat) grid. Retry up to 3× before giving up — a flat DEM makes the
  // whole heatmap meaningless, so this retry is essential.
  let dem = null;
  let usedRes = res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    // Later attempts degrade resolution — fewer tiles to fetch, far more
    // likely to complete on a congested network. A 48-cell susceptibility
    // surface beats no surface at all.
    const attemptRes = attempt <= 2 ? res : Math.min(res, 48);
    try {
      dem = await fetchElevationGrid(bbox, attemptRes, (p) => onProgress && onProgress(p, 'DEM'));
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < dem.heights.length; i++) {
        const v = dem.heights[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      if (mx - mn >= 1) { usedRes = attemptRes; break; } // real terrain relief — good grid
      dem = null;
      console.warn(`[susceptibility] DEM attempt ${attempt} flat (relief ${(mx - mn).toFixed(2)} m), retrying`);
    } catch (e) {
      dem = null;
      console.warn(`[susceptibility] DEM attempt ${attempt} failed:`, e?.message || e);
    }
    if (attempt < 4) await new Promise((r) => setTimeout(r, 3500 + Math.random() * 1500));
  }
  if (!dem) throw new Error('DEM unavailable after 4 retries (network stall)');
  res = usedRes;

  // Cell size in metres
  const midLatRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const cellXm = ((spanLon * 111320) * Math.cos(midLatRad)) / (res - 1);
  const cellYm = ((spanLat * 110540)) / (res - 1);
  const slopes = slopesFromDem(dem.heights, res, cellXm, cellYm);

  // Live antecedent rainfall (shared by every cell — the weather is regional;
  // the ML model differentiates cells through elevation + slope + season).
  const liveRain = rain || (await fetchLiveRainfall(lat, lon)) || {
    rain_1d: 42, rain_3d: 96, rain_7d: 178, rain_15d: 310, rain_max_7d: 88,
    source: 'monsoon-climatology',
  };

  const m = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const monthSin = Math.sin((2 * Math.PI * m) / 12);
  const monthCos = Math.cos((2 * Math.PI * m) / 12);

  // Score every cell through the trained GBDT in ONE batched inference.
  const n = res * res;
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    rows[i] = {
      ...liveRain,
      elevation_m: dem.heights[i],
      slope_deg: slopes[i],
      month_sin: monthSin,
      month_cos: monthCos,
    };
  }
  if (onProgress) onProgress(0.5, 'ML');
  const probs = await predictBatchLandslideProbability(rows);

  // Normalize with robust percentiles so the ramp uses the full dynamic range
  const sorted = Float32Array.from(probs).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))] || 0;
  const lo = q(0.05);
  const hi = Math.max(lo + 0.12, q(0.98));

  // Colorize → offscreen small canvas → smooth upscale to 1024
  const small = document.createElement('canvas');
  small.width = res; small.height = res;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(res, res);
  let highCount = 0, sum = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const p = probs[i];
    sum += p; if (p > max) max = p; if (p >= 0.55) highCount++;
    const t = (p - lo) / (hi - lo);
    const [r, g, b] = rampColor(t);
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b;
    img.data[o + 3] = t <= 0.05 ? 0 : Math.round(Math.min(1, t * 1.35) * 225);
  }
  sctx.putImageData(img, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, 1024, 1024);

  return {
    canvas,
    dem,
    probs,
    rain: liveRain,
    stats: {
      mean: sum / n,
      max,
      highRiskPct: (highCount / n) * 100,
      dominantSlope: slopes.reduce((a, b) => a + b, 0) / n,
      minElev: Math.min(...dem.heights),
      maxElev: Math.max(...dem.heights),
    },
  };
}
