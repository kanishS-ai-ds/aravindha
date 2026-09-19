# Disaster Video Studio — 3D Simulation Video Pipeline

**Module:** ARAVINDHA Video Studio
**Status:** Implemented (v2 — India documentary edition)
**Entry point:** Sidebar → **🎬 Video Studio** (`src/modules/video-studio-ui.js`)

---

## v2 additions — India hotspot catalog & documentary direction

- **India region selector (Step 1):** 13 documented landslide zones in
  `INDIA_REGIONS` — Wayanad, Kavalappara, Nilgiris, Idukki (Western Ghats),
  Kedarnath, Joshimath (Uttarakhand), Manali, Kinnaur (Himachal), Darjeeling,
  Gangtok (Eastern Himalaya), Cherrapunji (Meghalaya), Araku Valley (Eastern
  Ghats), Nilambur. Selecting one flies the map to the district, adopts a
  curated study bbox (auto-clamped ≤ 60 km²) and a geologic soil descriptor.
- **Trigger mechanism (Step 2):** rainfall cloudburst / earthquake (kh=0.18
  pseudostatic) / deforestation (root-cohesion loss) / construction (slope cut
  + surcharge) / combined — each maps to distinct FoS & Voellmy parameters.
- **Weather capture:** animated monsoon rain streaks, gusts and lightning
  flashes composited over the 3D scene.
- **Temporal progression:** documentary time-warp — slow pre-condition
  monitoring → saturation build-up → catastrophic failure at ×0.25 slow-motion
  → aftermath, with an on-screen PHASE badge.
- **Science overlays:** slope (mean/max), factor of safety, soil composition,
  trigger label, risk zoning (high/moderate/low %), evacuation route guidance,
  plus the existing impact assessment panel.

---

---

## 1. What it does

The Video Studio turns any area of the real world into a **cinematic, physics-based
disaster simulation video** (MP4/H.264 or WebM/VP9) with embedded data overlays:

1. **Select** an area on an interactive 3D satellite map — bounding box (two clicks),
   polygon (click vertices, double-click to close), or pin + configurable radius.
2. **Configure** the scenario: disaster type (landslide / flash flood), rainfall
   intensity & duration, soil saturation, time-of-day lighting, camera path,
   video length, resolution (720p / 1080p / 4K), format, terrain exaggeration.
3. **Render** through a staged pipeline with live preview and per-stage progress.
4. **Export** the encoded video with one click, plus a scenario impact summary.

---

## 2. Pipeline architecture

```
 [ Selection Map (MapLibre 3D + Esri imagery) ]
        │  bbox / polygon / pin+radius
        ▼
 [ video-studio-terrain.js ]
        │  Terrarium DEM PNG tiles (SRTM/NED composite, AWS elevation-tiles-prod)
        │  → Float32 elevation grid (160×160), slope grid, hillshade
        │  Esri World Imagery mosaic → drape texture
        │  Procedural land-cover classification (water/sand/grass/forest/rock/built)
        ▼
 [ video-studio-physics.js ]
        │  Hydrology: priority-flood depression filling (Wang & Liu), D8
        │  flow accumulation, Manning's n per land cover
        │
        │  FLASH FLOOD: 2D diffusive-wave shallow-water solver
        │    (Bates & De Roo LISFLOOD-FP style) → depth + velocity frames
        │
        │  LANDSLIDE: infinite-slope Factor of Safety (Mohr-Coulomb with
        │  pore pressure + pseudostatic seismic coefficient) → release zones;
        │  depth-averaged Voellmy-Salm runout with Hungr-Evans entrainment
        │  → debris thickness + velocity frames
        │
        │  Impact model: exposed population, buildings at risk,
        │  severity index, evacuation window
        ▼
 [ video-studio-renderer.js ]
        │  Offscreen MapLibre GL 3D terrain map (real DEM + satellite drape)
        │  Per-frame disaster field image drape (depth/thickness color ramps)
        │  Camera choreography: Aerial Sweep | Follow Flow Path |
        │    Time-Lapse Overview | Establishing Push-In
        │  Lighting presets: Midday | Monsoon Storm | Dusk | Night
        │  Broadcast HUD: mission clock, live metrics, impact panel,
        │    severity watermark, progress strip, vignette
        │  Composite canvas → MediaRecorder (VP9/H.264 by capability)
        ▼
 [ Download .mp4 / .webm + scenario summary ]
```

---

## 3. Module reference

| File | Responsibility |
|---|---|
| `src/modules/video-studio-terrain.js` | Web-Mercator math, tile fetch/decode, DEM grid, slope, hillshade, land cover, texture mosaics, bbox/pin helpers |
| `src/modules/video-studio-physics.js` | Depression filling, D8 accumulation, flash-flood diffusive-wave solver, FoS + Voellmy-Salm landslide solver, impact analytics |
| `src/modules/video-studio-renderer.js` | Offscreen 3D map, drape layer, camera paths, lighting, HUD overlay, MediaRecorder capture |
| `src/modules/video-studio-ui.js` | Staged UI workflow, selection tools, config panel, progress, preview, download |

---

## 4. Data sources (keyless, CORS-enabled)

- **Elevation:** `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
  (Terrarium encoding: `elev = R*256 + G + B/256 − 32768`)
- **Imagery:** Esri World Imagery (`server.arcgisonline.com`)
- Both are already used by the existing dashboard, so no new API keys are required.

Selection is limited to **≤ 64 km²** so the DEM fetch, physics and render stay
interactive (~160×160 grid ≈ 30–60 m cells for typical selections).

---

## 5. Physics summary

### Flash flood
- Rainfall is injected as `intensity × runoff coefficient`, with a storm ramp-down profile.
- Flow routing uses the diffusive-wave approximation with Manning friction:
  `v = (1/n) · d^(2/3) · √S` per cell face; mass-conserving flux divergence.
- Channels emerge automatically from D8 flow accumulation thresholds.
- Outputs: depth (m), velocity (m/s), discharge (m³/s), inundated km² per frame.

### Landslide
- **Initiation:** infinite-slope Factor of Safety,
  `FS = [c′ + (σn − u)·tanφ′] / τdriving`, with water table height from soil
  saturation and optional pseudostatic seismic coefficient `kh`.
- **Runout:** depth-averaged Voellmy-Salm rheology,
  `S = μ·ρg·h·cosβ + ρv²/ξ`, with gravitational acceleration on the local
  steepest-descent slope and Hungr-Evans bed entrainment bulking.
- Outputs: debris thickness (m), velocity (m/s), runout distance, mobile volume.

### Impact analytics
Exposure estimates combine affected area with configurable population/building
density, modulated by a severity index derived from peak depth or velocity,
and produce an evacuation time window.

---

## 6. Video export details

- Frame-exact capture: `canvas.captureStream(0)` + `track.requestFrame()` per frame.
- Bitrates: 8 Mbps (720p), 16 Mbps (1080p), 55 Mbps (4K).
- Codec negotiation: prefers `video/mp4;codecs=avc1` when supported (Chrome,
  Edge, Safari ≥ 14.1 desktop), falls back to `video/webm;codecs=vp9` (Firefox).
- The HUD overlay (clock, metrics, impact panel, severity %, progress bar) is
  composited into the video itself — the exported file is self-contained.

## 7. Known limits & next steps

- Building-footprint interaction uses density heuristics; wiring an OSM
  Overpass query would give per-structure hit lists.
- Water rendering is a color-ramp drape + HUD metrics; a refraction/specular
  water shader pass is the next visual upgrade.
- Narration-style TTS audio track could be muxed in via WebAudio during capture.

## Road-Network Intelligence (added Sep 2026)

Real OSM road networks now flow through the whole pipeline via
`src/modules/road-network.js` (Overpass API, multi-mirror fallback):

- **Overview tab** — "Road Connectivity" card has a live *Selected-Area Road
  Network* section: clicking anywhere on the map fetches that area's real road
  network (roads / km / at-risk / km-exposed KPIs + named road list), with a
  hazard radius driven by the ensemble risk score.
- **3D Simulation** — roads render as ribbons on the terrain and turn
  red/blocked when debris or flood frames intersect them; the sidebar Road
  Connectivity panel lists affected roads in real time.
- **Video Studio** — fetched roads drape over the cinematic terrain and the
  overlay/HUD reports blocked-road counts and cut-off percentages per frame.

Endpoints used: `overpass.kumi.systems`, `overpass-api.de` (POST, UA-tagged).
