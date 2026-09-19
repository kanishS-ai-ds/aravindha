/**
 * ARAVINDHA — ROAD NETWORK INTELLIGENCE
 * Real road data for any selected area + disaster-blockage analysis.
 *
 * Data source: OpenStreetMap via the Overpass API (free, no key).
 *   - Roads are fetched as ways with geometry (lat/lon polylines) + tags
 *     (highway class, name, bridge/tunnel flags).
 *   - Every vertex is projected onto the DEM grid so each road point carries
 *     its true terrain elevation (bilinear sample).
 *   - Blockage analysis walks the physics result's per-frame debris/water
 *     fields: a road vertex is "cut" when the simulated flow depth/thickness
 *     at its location exceeds a class-dependent threshold. A road way is
 *     blocked from the first frame it has any cut vertex.
 *
 * Consumers:
 *  - Video Studio / 3D viewer: draw roads as 3D ribbons, colour-coded
 *    intact (white/amber) → blocked (red), appearing as debris covers them.
 *  - Overview tab: Road Connectivity panel (counts, km, named cuts).
 *  - Cinematic renderer overlay: "ROADS CUT n/m" HUD chip.
 */

/* =========================================================
   OVERPASS FETCH
========================================================= */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
]

/** Highway classes worth rendering, with display + physics metadata.
 *  priority: draw order (1 = major). cutDepth: meters of debris/water that
 *  closes the road (motorway embankments survive shallow debris; tracks don't). */
export const ROAD_CLASSES = {
  motorway:      { priority: 1, color: 0xffd24a, width: 5.5, label: 'Highway',      cutDepth: 1.4 },
  trunk:         { priority: 1, color: 0xffd24a, width: 5.0, label: 'Highway',      cutDepth: 1.3 },
  primary:       { priority: 2, color: 0xffb84d, width: 4.2, label: 'Main road',    cutDepth: 1.0 },
  secondary:     { priority: 3, color: 0xffa94d, width: 3.4, label: 'District road', cutDepth: 0.8 },
  tertiary:      { priority: 4, color: 0xfff3c4, width: 2.8, label: 'Town road',    cutDepth: 0.6 },
  unclassified:  { priority: 5, color: 0xd8e2ea, width: 2.2, label: 'Local road',   cutDepth: 0.45 },
  residential:   { priority: 5, color: 0xd8e2ea, width: 2.0, label: 'Street',       cutDepth: 0.4 },
  service:       { priority: 6, color: 0xb8c4cc, width: 1.4, label: 'Service road', cutDepth: 0.35 },
  track:         { priority: 6, color: 0xc9bfa8, width: 1.4, label: 'Track',        cutDepth: 0.3 },
  road:          { priority: 5, color: 0xd8e2ea, width: 2.0, label: 'Road',         cutDepth: 0.45 }
}

function overpassQuery(bbox, maxZoomGuardKm2 = 400) {
  const { minLat, minLon, maxLat, maxLon } = bbox
  // Cap the bbox: Overpass timeouts on huge areas. Larger areas just get the
  // major network (primary and above), which is what matters at that scale.
  const midLat = (minLat + maxLat) / 2
  const wKm = Math.abs(maxLon - minLon) * 111.32 * Math.cos((midLat * Math.PI) / 180)
  const hKm = Math.abs(maxLat - minLat) * 110.54
  const big = wKm * hKm > maxZoomGuardKm2
  const classFilter = big
    ? 'way["highway"~"^(motorway|trunk|primary|secondary)$"]'
    : 'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|road)$"]'
  return `[out:json][timeout:30];(${classFilter}(${minLat},${minLon},${maxLat},${maxLon}););out geom;`
}

async function overpassFetch(query) {
  let lastErr
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      console.warn(`[road-network] endpoint failed (${ep}):`, err.message)
    }
  }
  throw lastErr || new Error('all Overpass endpoints failed')
}

/* =========================================================
   DEM PROJECTION HELPERS
========================================================= */

function bilinearHeight(dem, lat, lon) {
  const { bbox, res, heights } = dem
  const fx = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * (res - 1)
  const fy = ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * (res - 1)
  if (fx < 0 || fy < 0 || fx > res - 1 || fy > res - 1) return null
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const x1 = Math.min(res - 1, x0 + 1), y1 = Math.min(res - 1, y0 + 1)
  const tx = fx - x0, ty = fy - y0
  const h00 = heights[y0 * res + x0], h01 = heights[y0 * res + x1]
  const h10 = heights[y1 * res + x0], h11 = heights[y1 * res + x1]
  return (h00 * (1 - tx) + h01 * tx) * (1 - ty) + (h10 * (1 - tx) + h11 * tx) * ty
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/* =========================================================
   PUBLIC: FETCH + PROJECT ROADS
========================================================= */

/**
 * Fetch real roads for a bbox WITHOUT DEM projection (Overview map / lists).
 * @returns {Promise<{roads: Array, totalKm: number, source: string}>}
 */
export async function fetchRoadsForBbox(bbox, onProgress) {
  let data
  try {
    if (onProgress) onProgress(0.1, 'Querying OpenStreetMap roads…')
    data = await overpassFetch(overpassQuery(bbox))
  } catch (err) {
    console.warn('[road-network] fetch failed — roads disabled:', err.message)
    return { roads: [], totalKm: 0, source: 'unavailable' }
  }
  const roads = []
  for (const el of data.elements || []) {
    if (!el.geometry || el.geometry.length < 2) continue
    const tags = el.tags || {}
    const cls = ROAD_CLASSES[tags.highway] ? tags.highway : 'road'
    const pts = []
    let lengthM = 0
    let prev = null
    for (const g of el.geometry) {
      if (g == null || g.lat == null) continue
      pts.push({ lat: g.lat, lon: g.lon, h: 0 })
      if (prev) lengthM += haversineM(prev.lat, prev.lon, g.lat, g.lon)
      prev = g
    }
    if (pts.length < 2) continue
    roads.push({
      id: el.id,
      osmId: el.type + '/' + el.id,
      name: tags.name || tags.ref || ROAD_CLASSES[cls].label,
      class: cls,
      meta: ROAD_CLASSES[cls],
      pts,
      lengthKm: lengthM / 1000,
      isBridge: !!tags.bridge,
      isTunnel: !!tags.tunnel
    })
  }
  roads.sort((a, b) => a.meta.priority - b.meta.priority)
  const totalKm = roads.reduce((s, r) => s + r.lengthKm, 0)
  if (onProgress) onProgress(1, `${roads.length} roads / ${totalKm.toFixed(1)} km`)
  return { roads, totalKm, source: 'OpenStreetMap' }
}

/**
 * Fetch real roads for the bbox and project them onto the DEM.
 * @returns {Promise<{roads: Array, totalKm: number, source: string}>}
 *   roads: [{ id, name, class, meta, pts: [{lat,lon,h}], lengthKm, isBridge, isTunnel }]
 */
export async function fetchRoadNetwork(dem, onProgress) {
  const bbox = dem.bbox
  const base = await fetchRoadsForBbox(bbox, onProgress)
  if (!base.roads.length) return base
  // Project every vertex onto the DEM (true terrain elevation for 3D ribbons)
  for (const road of base.roads) {
    const kept = []
    for (const p of road.pts) {
      const h = bilinearHeight(dem, p.lat, p.lon)
      if (h != null) kept.push({ ...p, h })
    }
    road.pts = kept
  }
  base.roads = base.roads.filter(r => r.pts.length >= 2)
  return base
}

/* =========================================================
   PUBLIC: BLOCKAGE ANALYSIS vs SIMULATION FRAMES
========================================================= */

/**
 * Compute per-road blockage over the simulation timeline.
 * @param {Array} roads        from fetchRoadNetwork()
 * @param {Object} dem         with .bbox and .res
 * @param {Array} frames       simResult.frameHeights (debris m) or frameDepths (water m)
 * @param {String} mode        'landslide' | 'flood'
 * @returns roadImpact = {
 *   perRoad: Map<osmId, {blockedFromFrame:number|null, maxDepth:number, cutPoints:Array}>
 *   blockedCount, total, blockedKm, timeline: [{frame, blockedCount}]
 * }
 */
export function analyzeRoadBlockage(roads, dem, frames, mode) {
  const res = dem.res
  const { minLat, minLon, maxLat, maxLon } = dem.bbox
  const perRoad = new Map()
  const timeline = []

  for (const road of roads) {
    const info = { blockedFromFrame: null, maxDepth: 0, cutPoints: [] }
    perRoad.set(road.osmId, info)

    for (let fi = 0; fi < frames.length; fi++) {
      const field = frames[fi]
      let blockedThisFrame = false
      for (const p of road.pts) {
        const fx = ((p.lon - minLon) / (maxLon - minLon)) * (res - 1)
        const fy = ((maxLat - p.lat) / (maxLat - minLat)) * (res - 1)
        if (fx < 0 || fy < 0 || fx > res - 1 || fy > res - 1) continue
        // nearest-cell flow depth at this road vertex (3x3 max pool so a thin
        // debris finger 1 cell wide still registers on a coarse DEM)
        const x0 = Math.round(fx), y0 = Math.round(fy)
        let depth = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y0 + dy
          if (yy < 0 || yy >= res) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x0 + dx
            if (xx < 0 || xx >= res) continue
            const v = field[yy * res + xx] || 0
            if (v > depth) depth = v
          }
        }
        if (depth > info.maxDepth) info.maxDepth = depth
        const cut = depth >= road.meta.cutDepth
        if (cut && info.blockedFromFrame == null) {
          info.blockedFromFrame = fi
          info.cutPoints.push({ lat: p.lat, lon: p.lon, depth })
        }
        if (cut) blockedThisFrame = true
      }
      const entry = timeline[fi] || (timeline[fi] = { frame: fi, blockedCount: 0 })
      if (blockedThisFrame) entry.blockedCount++
    }
  }

  let blockedCount = 0
  let blockedKm = 0
  for (const road of roads) {
    const info = perRoad.get(road.osmId)
    if (info && info.blockedFromFrame != null) {
      blockedCount++
      blockedKm += road.lengthKm
    }
  }

  return { perRoad, blockedCount, total: roads.length, blockedKm, timeline }
}

/** Human sentence for overlays/HUD, e.g. "NH-67 cut at 2 points". */
/**
 * Which roads enter a hazard circle? (Overview / dashboard blockage check.)
 * hazard: { lat, lng, radiusKm } → sorted [{ road, distKm }] (priority first).
 */
export function identifyAffectedRoads(net, hazard) {
  const out = [];
  for (const road of (net?.roads || [])) {
    let minD = Infinity;
    for (const p of road.pts) {
      const dy = (p.lat - hazard.lat) * 110.54;
      const dx = (p.lon - hazard.lng) * 111.32 * Math.cos(hazard.lat * Math.PI / 180);
      const d = Math.hypot(dx, dy);
      if (d < minD) minD = d;
    }
    if (minD <= hazard.radiusKm) out.push({ road, distKm: minD });
  }
  out.sort((a, b) => a.road.meta.priority - b.road.meta.priority || a.distKm - b.distKm);
  return out;
}

export function roadStatusSentence(roadImpact, roads) {
  if (!roadImpact || !roads.length) return null
  const cut = roads
    .filter(r => roadImpact.perRoad.get(r.osmId)?.blockedFromFrame != null)
    .sort((a, b) => a.meta.priority - b.meta.priority) // most major first
  if (!cut.length) return 'All roads passable'
  const primary = cut[0]
  const extra = cut.length > 1 ? ` +${cut.length - 1} more` : ''
  return `${primary.name} blocked${extra}`
}
