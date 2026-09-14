/**
 * ARAVINDHA - DISASTER VIDEO STUDIO
 * Orchestrator UI: staged workflow from map area selection → terrain fetch →
 * physics simulation → cinematic 3D render → video export/download.
 *
 * Stages:
 *   1. SELECT   – draw bbox / polygon / drop pin+radius on a live map
 *   2. CONFIG   – disaster type, rainfall, lighting, camera, resolution
 *   3. RENDER   – terrain + physics + cinematic frame capture (live preview)
 *   4. EXPORT   – MP4 / WebM download with embedded data overlays
 */

import * as maplibregl from 'maplibre-gl'
import {
  fetchElevationGrid,
  fetchTextureCanvas,
  computeSlopes,
  pinToBbox,
  bboxDimensionsMeters,
  classifyLandCover,
  renderHillshade,
  composeDrape
} from './video-studio-terrain.js'
import {
  simulateFlashFlood,
  simulateLandslide,
  computeFactorOfSafety,
  analyzeImpacts
} from './video-studio-physics.js'
import {
  CinematicVideoRenderer,
  RESOLUTIONS,
  LIGHTING_PRESETS,
  CAMERA_PATHS
} from './video-studio-renderer.js'

const DEM_GRID_RES = 160
const MAX_AREA_KM2 = 64

export class VideoStudioUI {
  constructor(containerId) {
    this.containerId = containerId
    this.selectionMap = null
    this.selection = null // { type, bbox, points?, pin?, radiusM }
    this.drawMode = 'bbox' // 'bbox' | 'polygon' | 'pin'
    this.drawPoints = []
    this.tempMarkers = []
    this.tempSource = null
    this.radiusM = 2000
    this.renderer = null
    this.resultBlob = null
    this.resultMime = null
    this.running = false
    this.mounted = false
    this.activated = false
  }

  /* =========================================================
     MOUNT
  ========================================================= */

  mount() {
    if (this.mounted) return
    const container = document.getElementById(this.containerId)
    if (!container) return

    container.innerHTML = `
      <div class="vstudio">

        <div class="vstudio-hero">
          <div>
            <div class="vstudio-kicker">DISASTER VIDEO STUDIO</div>
            <h2>Cinematic 3D Disaster Simulation Renderer</h2>
            <p>Select any area on Earth, fetch real terrain, run physics-based
            landslide or flash-flood simulations and export a narrated-style
            data-rich cinematic video.</p>
          </div>
          <div class="vstudio-stage-rail" id="vsStageRail">
            <div class="vs-stage active" data-stage="select"><span>1</span>SELECT AREA</div>
            <div class="vs-stage" data-stage="config"><span>2</span>CONFIGURE</div>
            <div class="vs-stage" data-stage="render"><span>3</span>RENDER</div>
            <div class="vs-stage" data-stage="export"><span>4</span>EXPORT</div>
          </div>
        </div>

        <div class="vstudio-grid">

          <!-- LEFT: SELECTION -->
          <div class="vstudio-panel">
            <div class="vstudio-panel-head">
              <div>
                <div class="vstudio-kicker">STEP 1</div>
                <h3>Select Geographic Area</h3>
              </div>
              <div class="vs-draw-modes">
                <button class="vs-mode-btn active" data-draw="bbox" title="Click twice: opposite corners">▭ Box</button>
                <button class="vs-mode-btn" data-draw="polygon" title="Click vertices, double-click to close">⬡ Polygon</button>
                <button class="vs-mode-btn" data-draw="pin" title="Drop a pin with radius">📍 Pin + Radius</button>
              </div>
            </div>
            <div class="vs-map-wrap">
              <div id="vsSelectMap" class="vs-map"></div>
              <div class="vs-map-hint" id="vsMapHint">Click two opposite corners to draw the analysis box</div>
              <div class="vs-map-legend">
                <span class="dot dem"></span> Real DEM terrain
                <span class="dot sat"></span> Satellite imagery
              </div>
            </div>
            <div class="vs-selection-info" id="vsSelectionInfo">
              No area selected — use the drawing tools above, or
              <button class="vs-link" id="vsDemoAreaBtn">load a demo area (Wayanad)</button>
            </div>
          </div>

          <!-- RIGHT: CONFIG -->
          <div class="vstudio-panel">
            <div class="vstudio-panel-head">
              <div>
                <div class="vstudio-kicker">STEP 2</div>
                <h3>Simulation & Camera Configuration</h3>
              </div>
            </div>

            <div class="vs-config">

              <div class="vs-cfg-row">
                <label>Disaster Type</label>
                <div class="vs-seg" id="vsDisasterSeg">
                  <button class="vs-seg-btn active" data-mode="landslide">🌋 Landslide</button>
                  <button class="vs-seg-btn" data-mode="flood">🌊 Flash Flood</button>
                </div>
              </div>

              <div class="vs-cfg-row">
                <label>Rainfall Intensity <strong id="vsRainVal">85 mm/h</strong></label>
                <input type="range" id="vsRainfall" min="10" max="220" value="85" />
                <div class="vs-range-scale"><span>drizzle</span><span>monsoon</span><span>cloudburst</span></div>
              </div>

              <div class="vs-cfg-row">
                <label>Rain Duration <strong id="vsDurVal">90 min</strong></label>
                <input type="range" id="vsRainDur" min="15" max="360" step="15" value="90" />
              </div>

              <div class="vs-cfg-row">
                <label>Soil Saturation <strong id="vsSatVal">80 %</strong></label>
                <input type="range" id="vsSat" min="10" max="100" value="80" />
              </div>

              <div class="vs-cfg-row vs-inline">
                <div>
                  <label>Lighting / Time of Day</label>
                  <select id="vsLighting">
                    <option value="day">Midday Clear</option>
                    <option value="storm" selected>Monsoon Storm</option>
                    <option value="dusk">Dusk / Golden Hour</option>
                    <option value="night">Night Ops</option>
                  </select>
                </div>
                <div>
                  <label>Camera Path</label>
                  <select id="vsCamera">
                    <option value="aerialSweep" selected>Aerial Sweep</option>
                    <option value="followPath">Follow Flow Path</option>
                    <option value="timeLapse">Time-Lapse Overview</option>
                    <option value="establishing">Establishing Push-In</option>
                  </select>
                </div>
              </div>

              <div class="vs-cfg-row vs-inline">
                <div>
                  <label>Video Length <strong id="vsLenVal">20 s</strong></label>
                  <input type="range" id="vsVideoLen" min="8" max="60" step="2" value="20" />
                </div>
                <div>
                  <label>Resolution</label>
                  <select id="vsResolution">
                    <option value="720p">HD 720p</option>
                    <option value="1080p" selected>Full HD 1080p</option>
                    <option value="4k">UHD 4K</option>
                  </select>
                </div>
              </div>

              <div class="vs-cfg-row vs-inline">
                <div>
                  <label>Format</label>
                  <select id="vsFormat">
                    <option value="mp4" selected>MP4 (H.264)</option>
                    <option value="webm">WebM (VP9)</option>
                  </select>
                </div>
                <div>
                  <label>Terrain Exaggeration <strong id="vsExagVal">1.4×</strong></label>
                  <input type="range" id="vsExag" min="10" max="25" value="14" />
                </div>
              </div>

              <div class="vs-cfg-row vs-checks">
                <label class="vs-check"><input type="checkbox" id="vsOverlays" checked /> Data overlays (clock, metrics, impact)</label>
                <label class="vs-check"><input type="checkbox" id="vsImagery" checked /> Satellite imagery drape</label>
              </div>

            </div>

            <button class="vs-generate" id="vsGenerateBtn" disabled>
              ▶ GENERATE CINEMATIC VIDEO
            </button>
            <div class="vs-generate-note" id="vsGenerateNote">Select an area first</div>
          </div>
        </div>

        <!-- RENDER PROGRESS + PREVIEW -->
        <div class="vstudio-panel vs-render-panel" id="vsRenderPanel" style="display:none">
          <div class="vstudio-panel-head">
            <div>
              <div class="vstudio-kicker">STEP 3 — RENDER PIPELINE</div>
              <h3 id="vsRenderTitle">Processing…</h3>
            </div>
            <button class="vs-cancel" id="vsCancelBtn">✕ Cancel</button>
          </div>
          <div class="vs-stages" id="vsStageList">
            <div class="vs-pstage" data-rstage="terrain"><span class="vs-ps-icon">⛰</span><div><strong>Terrain Acquisition</strong><em id="vsP-terrain">Waiting</em><div class="vs-ps-bar"><span id="vsB-terrain"></span></div></div></div>
            <div class="vs-pstage" data-rstage="physics"><span class="vs-ps-icon">🧮</span><div><strong>Disaster Physics</strong><em id="vsP-physics">Waiting</em><div class="vs-ps-bar"><span id="vsB-physics"></span></div></div></div>
            <div class="vs-pstage" data-rstage="render"><span class="vs-ps-icon">🎬</span><div><strong>Cinematic Render</strong><em id="vsP-render">Waiting</em><div class="vs-ps-bar"><span id="vsB-render"></span></div></div></div>
            <div class="vs-pstage" data-rstage="export"><span class="vs-ps-icon">💾</span><div><strong>Video Encoding</strong><em id="vsP-export">Waiting</em><div class="vs-ps-bar"><span id="vsB-export"></span></div></div></div>
          </div>
          <div class="vs-preview-wrap">
            <canvas id="vsPreviewCanvas" class="vs-preview"></canvas>
            <video id="vsPreviewVideo" class="vs-preview" controls style="display:none"></video>
          </div>
          <div class="vs-export-row" id="vsExportRow" style="display:none">
            <button class="vs-download" id="vsDownloadBtn">⬇ Download Video</button>
            <div class="vs-export-meta" id="vsExportMeta"></div>
          </div>
          <div class="vs-error-box" id="vsErrorBox" style="display:none"></div>
          <div class="vs-impact-summary" id="vsImpactSummary"></div>
        </div>

      </div>
    `

    this.bindEvents()
    this.mounted = true
  }

  /* =========================================================
     SELECTION MAP
  ========================================================= */

  ensureSelectionMap() {
    if (this.selectionMap || this.activated === false) {
      if (this.selectionMap) return
    }
    const el = document.getElementById('vsSelectMap')
    if (!el) return

    this.selectionMap = new maplibregl.Map({
      container: 'vsSelectMap',
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri'
          },
          dem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14
          }
        },
        layers: [{ id: 'sat', type: 'raster', source: 'satellite' }],
        terrain: { source: 'dem', exaggeration: 1.2 }
      },
      center: [76.13, 11.52],
      zoom: 10.5,
      pitch: 30,
      bearing: 0,
      attributionControl: false
    })
    this.selectionMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    this.selectionMap.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left')

    this.selectionMap.on('load', () => {
      this.selectionMap.addSource('vs-draw', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
      this.selectionMap.addLayer({
        id: 'vs-draw-fill',
        type: 'fill',
        source: 'vs-draw',
        paint: { 'fill-color': '#e8382f', 'fill-opacity': 0.14 }
      })
      this.selectionMap.addLayer({
        id: 'vs-draw-line',
        type: 'line',
        source: 'vs-draw',
        paint: { 'line-color': '#ff5544', 'line-width': 2.4 }
      })
      this.tempSource = this.selectionMap.getSource('vs-draw')
      this.redrawTemp()
    })

    this.selectionMap.on('click', e => this.handleMapClick(e))
    this.selectionMap.on('dblclick', () => {
      if (this.drawMode === 'polygon' && this.drawPoints.length >= 3) this.finalizeSelection()
    })
    this.activated = true
  }

  handleMapClick(e) {
    const { lng, lat } = e.lngLat
    if (this.drawMode === 'pin') {
      this.selection = { type: 'pin', pin: [lng, lat], radiusM: this.radiusM, bbox: pinToBbox(lat, lng, this.radiusM) }
      this.drawPoints = []
      this.redrawTemp()
      this.updateSelectionInfo()
      return
    }
    if (this.drawMode === 'bbox') {
      this.drawPoints.push([lng, lat])
      if (this.drawPoints.length === 2) {
        const [a, b] = this.drawPoints
        this.selection = {
          type: 'bbox',
          points: [...this.drawPoints],
          bbox: {
            minLon: Math.min(a[0], b[0]), maxLon: Math.max(a[0], b[0]),
            minLat: Math.min(a[1], b[1]), maxLat: Math.max(a[1], b[1])
          }
        }
        this.redrawTemp()
        this.updateSelectionInfo()
      } else {
        this.redrawTemp()
        this.setHint('Now click the opposite corner…')
      }
      return
    }
    if (this.drawMode === 'polygon') {
      this.drawPoints.push([lng, lat])
      this.redrawTemp()
      this.setHint(`${this.drawPoints.length} vertices — double-click to close`)
    }
  }

  redrawTemp() {
    if (!this.tempSource) return
    const features = []

    if (this.selection && this.selection.bbox && this.drawMode !== 'polygon') {
      const b = this.selection.bbox
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [b.minLon, b.minLat], [b.maxLon, b.minLat],
            [b.maxLon, b.maxLat], [b.minLon, b.maxLat], [b.minLon, b.minLat]
          ]]
        }
      })
    } else if (this.selection && this.selection.type === 'polygon') {
      const ring = [...this.selection.points, this.selection.points[0]]
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })
    }

    if (this.drawMode === 'pin' && this.selection?.pin) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: this.selection.pin }
      })
    }

    // In-progress polyline
    if (this.drawPoints.length > 1) {
      features.push({
        type: 'Feature',
        properties: { temp: true },
        geometry: { type: 'LineString', coordinates: this.drawPoints }
      })
    }
    if (this.drawMode === 'pin' && this.drawPoints.length === 1) {
      // radius preview circle
      features.push(this.circleFeature(this.drawPoints[0], this.radiusM))
    }

    this.tempSource.setData({ type: 'FeatureCollection', features })
  }

  circleFeature([lon, lat], radiusM) {
    const pts = []
    for (let a = 0; a <= 64; a++) {
      const ang = (a / 64) * Math.PI * 2
      const dLat = (radiusM * Math.cos(ang)) / 110540
      const dLon = (radiusM * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180))
      pts.push([lon + dLon, lat + dLat])
    }
    return { type: 'Feature', properties: { circle: true }, geometry: { type: 'LineString', coordinates: pts } }
  }

  finalizeSelection() {
    if (this.drawMode === 'polygon' && this.drawPoints.length >= 3) {
      const lons = this.drawPoints.map(p => p[0])
      const lats = this.drawPoints.map(p => p[1])
      this.selection = {
        type: 'polygon',
        points: [...this.drawPoints],
        bbox: {
          minLon: Math.min(...lons), maxLon: Math.max(...lons),
          minLat: Math.min(...lats), maxLat: Math.max(...lats)
        }
      }
      this.redrawTemp()
      this.updateSelectionInfo()
    }
  }

  updateSelectionInfo() {
    const info = document.getElementById('vsSelectionInfo')
    const btn = document.getElementById('vsGenerateBtn')
    const note = document.getElementById('vsGenerateNote')
    if (!this.selection) {
      info.innerHTML = 'No area selected — use the drawing tools above, or <button class="vs-link" id="vsDemoAreaBtn">load a demo area (Wayanad)</button>'
      document.getElementById('vsDemoAreaBtn')?.addEventListener('click', () => this.loadDemoArea())
      btn.disabled = true
      note.textContent = 'Select an area first'
      return
    }
    const dims = bboxDimensionsMeters(this.selection.bbox)
    const areaKm2 = (dims.width * dims.height) / 1e6
    const res = (dims.width / DEM_GRID_RES).toFixed(1)
    const ok = areaKm2 <= MAX_AREA_KM2

    info.innerHTML = `
      <div class="vs-sel-stats">
        <div><strong>${this.selection.type === 'pin' ? 'Pin + Radius' : this.selection.type === 'polygon' ? 'Polygon' : 'Bounding Box'}</strong></div>
        <div>${dims.width.toLocaleString()} m × ${dims.height.toLocaleString()} m</div>
        <div>${areaKm2.toFixed(2)} km²</div>
        <div>DEM cell ≈ ${res} m (${DEM_GRID_RES}² grid)</div>
        <div>${this.selection.bbox.minLat.toFixed(4)}°N–${this.selection.bbox.maxLat.toFixed(4)}°N, ${this.selection.bbox.minLon.toFixed(4)}°E–${this.selection.bbox.maxLon.toFixed(4)}°E</div>
        ${ok ? '<div class="ok">✓ Ready to simulate</div>' : `<div class="bad">⚠ Area too large (max ${MAX_AREA_KM2} km²)</div>`}
      </div>
      <button class="vs-link" id="vsClearSelBtn">clear selection</button>
    `
    document.getElementById('vsClearSelBtn')?.addEventListener('click', () => this.clearSelection())
    btn.disabled = !ok
    note.textContent = ok
      ? `${RESOLUTIONS[document.getElementById('vsResolution').value].label} • ${this.readDisasterMode() === 'flood' ? 'Flash flood' : 'Landslide'} physics`
      : 'Reduce the selected area size'
  }

  clearSelection() {
    this.selection = null
    this.drawPoints = []
    this.redrawTemp()
    this.updateSelectionInfo()
    this.setHint('Click two opposite corners to draw the analysis box')
  }

  loadDemoArea() {
    this.selectionMap.jumpTo({ center: [76.13, 11.52], zoom: 12.2, pitch: 40 })
    this.selection = {
      type: 'bbox',
      bbox: { minLon: 76.09, minLat: 11.49, maxLon: 76.17, maxLat: 11.55 }
    }
    this.drawPoints = []
    this.redrawTemp()
    this.updateSelectionInfo()
  }

  setHint(text) {
    const el = document.getElementById('vsMapHint')
    if (el) el.textContent = text
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  bindEvents() {
    document.querySelectorAll('.vs-mode-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.vs-mode-btn').forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        this.drawMode = b.dataset.draw
        this.drawPoints = []
        if (this.drawMode !== 'polygon' && this.selection?.type === 'polygon') this.selection = null
        this.redrawTemp()
        this.updateSelectionInfo()
        const hints = {
          bbox: 'Click two opposite corners to draw the analysis box',
          polygon: 'Click vertices of the hazard zone, double-click to close',
          pin: 'Click to drop the disaster origin pin'
        }
        this.setHint(hints[this.drawMode])
      })
    })

    document.querySelectorAll('.vs-seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.vs-seg-btn').forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        this.updateSelectionInfo()
      })
    })

    const bind = (id, valId, fmt) => {
      const el = document.getElementById(id)
      el.addEventListener('input', () => {
        document.getElementById(valId).textContent = fmt(el.value)
      })
      el.dispatchEvent(new Event('input'))
    }
    bind('vsRainfall', 'vsRainVal', v => `${v} mm/h`)
    bind('vsRainDur', 'vsDurVal', v => `${v} min`)
    bind('vsSat', 'vsSatVal', v => `${v} %`)
    bind('vsVideoLen', 'vsLenVal', v => `${v} s`)
    bind('vsExag', 'vsExagVal', v => `${(v / 10).toFixed(1)}×`)

    document.getElementById('vsGenerateBtn').addEventListener('click', () => this.runPipeline())
    document.getElementById('vsCancelBtn').addEventListener('click', () => {
      this.renderer?.abort()
      this.running = false
    })
    document.getElementById('vsDemoAreaBtn')?.addEventListener('click', () => this.loadDemoArea())
    document.getElementById('vsDownloadBtn').addEventListener('click', () => this.downloadResult())
  }

  readDisasterMode() {
    return document.querySelector('.vs-seg-btn.active')?.dataset.mode || 'landslide'
  }

  readConfig() {
    return {
      mode: this.readDisasterMode(),
      rainfallMmPerHour: Number(document.getElementById('vsRainfall').value),
      durationMinutes: Number(document.getElementById('vsRainDur').value),
      saturationPct: Number(document.getElementById('vsSat').value),
      lighting: document.getElementById('vsLighting').value,
      cameraPath: document.getElementById('vsCamera').value,
      videoDurationSec: Number(document.getElementById('vsVideoLen').value),
      resolution: document.getElementById('vsResolution').value,
      format: document.getElementById('vsFormat').value,
      terrainExaggeration: Number(document.getElementById('vsExag').value) / 10,
      showOverlays: document.getElementById('vsOverlays').checked,
      useImagery: document.getElementById('vsImagery').checked,
      fps: 30
    }
  }

  /* =========================================================
     STAGE UI HELPERS
  ========================================================= */

  setStageUI(stage, pct, label, state) {
    const el = document.getElementById(`vsP-${stage}`)
    const bar = document.getElementById(`vsB-${stage}`)
    const card = document.querySelector(`.vs-pstage[data-rstage="${stage}"]`)
    if (el) el.textContent = label
    if (bar) bar.style.width = `${Math.round(pct * 100)}%`
    if (card) {
      card.classList.remove('active', 'done', 'error')
      if (state) card.classList.add(state)
    }
  }

  activateRenderPanel() {
    const panel = document.getElementById('vsRenderPanel')
    panel.style.display = 'block'
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById('vsPreviewVideo').style.display = 'none'
    document.getElementById('vsPreviewCanvas').style.display = 'block'
    document.getElementById('vsExportRow').style.display = 'none'
    document.getElementById('vsImpactSummary').innerHTML = ''
    const errBox = document.getElementById('vsErrorBox')
    if (errBox) errBox.style.display = 'none'
    ;['terrain', 'physics', 'render', 'export'].forEach(s => {
      this.setStageUI(s, 0, 'Waiting', null)
    })
  }

  setStageRail(stage) {
    document.querySelectorAll('#vsStageRail .vs-stage').forEach(el => {
      el.classList.toggle('active', el.dataset.stage === stage)
    })
  }

  /* =========================================================
     PIPELINE
  ========================================================= */

  async runPipeline() {
    if (this.running || !this.selection) return
    this.running = true
    this.activateRenderPanel()
    this.setStageRail('render')

    const config = this.readConfig()
    const bbox = this.selection.bbox
    const dims = bboxDimensionsMeters(bbox)

    try {
      /* ---------- STAGE 1: TERRAIN ---------- */
      this.setStageUI('terrain', 0.02, 'Fetching DEM tiles…', 'active')
      const dem = await fetchElevationGrid(bbox, DEM_GRID_RES, (p, label) =>
        this.setStageUI('terrain', p * 0.5, label, 'active')
      )
      dem.cellSizeMeters = dims.width / DEM_GRID_RES
      const slopes = computeSlopes(dem)

      let texture = null
      if (config.useImagery) {
        this.setStageUI('terrain', 0.55, 'Fetching satellite imagery…', 'active')
        texture = await fetchTextureCanvas(bbox, 1024, 'satellite', (p, label) =>
          this.setStageUI('terrain', 0.5 + p * 0.45, label, 'active')
        ).catch(() => null)
      }
      const cover = classifyLandCover(dem, slopes)
      const hill = renderHillshade(dem, 0.8)
      this.drapeCanvas = composeDrape(cover, texture?.canvas, hill, { hillshade: true })

      const elevMinMax = (() => {
        let mn = Infinity, mx = -Infinity
        for (const v of dem.heights) { if (v < mn) mn = v; if (v > mx) mx = v }
        return { mn: Math.round(mn), mx: Math.round(mx) }
      })()
      this.setStageUI('terrain', 1, `Done — ${dem.description}, relief ${elevMinMax.mn}–${elevMinMax.mx} m`, 'done')

      /* ---------- STAGE 2: PHYSICS ---------- */
      this.setStageUI('physics', 0.05, 'Pre-processing hydrology…', 'active')
      await this.tick()

      let simResult
      if (config.mode === 'flood') {
        simResult = await simulateFlashFlood(dem, coverCodesFromCanvas(cover), {
          rainfallMmPerHour: config.rainfallMmPerHour,
          durationMinutes: config.durationMinutes,
          outputFrames: 90
        })
      } else {
        const { fs } = computeFactorOfSafety(dem, slopes, {
          saturationPct: config.saturationPct,
          cohesionKPa: 14,
          frictionAngle: 30,
          soilDepthMeters: 2.5,
          seismicKh: 0
        })
        this.setStageUI('physics', 0.35, 'Factor-of-safety computed — running runout dynamics…', 'active')
        await this.tick()
        simResult = simulateLandslide(dem, slopes, fs, {
          outputFrames: 90,
          simSeconds: 90,
          mu: 0.18,
          xi: 450,
          saturationPct: config.saturationPct
        })
      }
      const impacts = analyzeImpacts(simResult.stats, config.mode === 'flood' ? 'flood' : 'landslide', dem)
      this.setStageUI('physics', 1,
        `Done — ${config.mode === 'flood'
          ? `peak depth ${simResult.stats.maxDepth.toFixed(2)} m, ${simResult.stats.peakSpeed.toFixed(1)} m/s`
          : `runout ${Math.round(simResult.stats.maxRunout)} m @ ${simResult.stats.peakSpeed.toFixed(1)} m/s`}`,
        'done')

      /* ---------- STAGE 3: CINEMATIC RENDER ---------- */
      this.setStageUI('render', 0.02, 'Building offscreen 3D terrain scene…', 'active')
      this.renderer = new CinematicVideoRenderer()
      await this.renderer.initMap(bbox, dem, config)
      this.setStageUI('render', 0.15, '3D scene ready — draping disaster fields…', 'active')
      await this.renderer.prepareDisasterDrape(simResult, config.mode === 'flood' ? 'flood' : 'landslide')
      this.renderer.impacts = impacts
      this.renderer.attachDrapeLayer()
      this.setStageUI('render', 0.25, 'Capturing cinematic frames…', 'active')

      const previewCanvas = document.getElementById('vsPreviewCanvas')
      previewCanvas.width = this.renderer.compositeCanvas.width
      previewCanvas.height = this.renderer.compositeCanvas.height
      const pctx = previewCanvas.getContext('2d')

      const { blob, mime, ext } = await this.renderer.recordVideo({
        fps: config.fps,
        durationSec: config.videoDurationSec,
        cameraPath: config.cameraPath,
        mode: config.mode === 'flood' ? 'flood' : 'landslide',
        simResult,
        config,
        onFrame: (frame, total) => {
          const p = 0.25 + 0.7 * (frame / total)
          this.setStageUI('render', p, `Frame ${frame + 1}/${total}`, 'active')
          pctx.drawImage(this.renderer.compositeCanvas, 0, 0, previewCanvas.width, previewCanvas.height)
        }
      })

      this.setStageUI('render', 1, `Rendered ${config.videoDurationSec}s @ ${config.fps}fps`, 'done')

      /* ---------- STAGE 4: EXPORT ---------- */
      this.setStageUI('export', 0.4, `Packaging ${ext.toUpperCase()}…`, 'active')
      this.resultBlob = blob
      this.resultMime = mime
      const url = URL.createObjectURL(blob)
      const video = document.getElementById('vsPreviewVideo')
      video.src = url
      video.style.display = 'block'
      document.getElementById('vsPreviewCanvas').style.display = 'none'
      document.getElementById('vsExportRow').style.display = 'flex'
      document.getElementById('vsExportMeta').innerHTML =
        `${(blob.size / 1e6).toFixed(1)} MB • ${RESOLUTIONS[config.resolution].label} • ${mime.split(';')[0]}`

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      this.downloadName = `aravindha-${config.mode}-${config.resolution}-${stamp}.${ext}`
      this.resultUrl = url

      this.setStageUI('export', 1, 'Ready to download', 'done')
      this.renderImpactSummary(impacts, config, simResult)
      this.setStageRail('export')
    } catch (err) {
      console.error('[video-studio] pipeline failed:', err)
      const stages = ['terrain', 'physics', 'render', 'export']
      const activeStage = stages.find(
        s => document.querySelector(`.vs-pstage[data-rstage="${s}"]`)?.classList.contains('active')
      )
      const stage = activeStage || 'render'
      this.setStageUI(stage, 0, `Error: ${err.message}`, 'error')
      // Always surface the failure in the DOM — silent catches here made
      // pipeline bugs invisible to users.
      const errBox = document.getElementById('vsErrorBox')
      if (errBox) {
        errBox.textContent = `⚠ ${stage.toUpperCase()} STAGE FAILED — ${err.message}`
        errBox.style.display = 'block'
      }
    } finally {
      this.running = false
    }
  }

  tick() {
    return new Promise(r => setTimeout(r, 30))
  }

  renderImpactSummary(impacts, config, simResult) {
    const el = document.getElementById('vsImpactSummary')
    if (!el) return
    const modeLabel = config.mode === 'flood' ? 'Flash Flood' : 'Landslide'
    const light = LIGHTING_PRESETS[config.lighting]?.label || 'Custom lighting'
    const cam = CAMERA_PATHS[config.cameraPath]?.label || 'Custom camera'
    const peak =
      config.mode === 'flood'
        ? (simResult.stats.maxDepth ?? 0)
        : (simResult.stats.maxThickness ?? simResult.stats.timeline?.at(-1)?.maxThickness ?? 0)
    const fmt = (v, d = 2) => Number(v ?? 0).toFixed(d)
    const num = (v) => Math.round(Number(v ?? 0)).toLocaleString()
    el.innerHTML = `
      <div class="vs-impact-title">${modeLabel.toUpperCase()} — SCENARIO SUMMARY (${light}, ${cam})</div>
      <div class="vs-impact-grid">
        <div><span>Peak ${config.mode === 'flood' ? 'water depth' : 'debris thickness'}</span><strong>${fmt(peak)} m</strong></div>
        <div><span>Peak velocity</span><strong>${fmt(simResult.stats.peakSpeed, 1)} m/s</strong></div>
        <div><span>${config.mode === 'flood' ? 'Inundated area' : 'Max runout'}</span><strong>${config.mode === 'flood' ? fmt(impacts.affectedAreaKm2) + ' km²' : num(simResult.stats.maxRunout) + ' m'}</strong></div>
        <div><span>Population exposed</span><strong>${num(impacts.populationExposed)}</strong></div>
        <div><span>Buildings at risk</span><strong>${num(impacts.buildingsAtRisk)}</strong></div>
        <div><span>Evacuation window</span><strong>${Math.round(impacts.evacuationWindowMin ?? 0)} min</strong></div>
        <div><span>Severity index</span><strong class="sev">${Math.round(impacts.severityPct ?? 0)}%</strong></div>
      </div>
      <div class="vs-disclaimer">Physics-based indicative estimates from real DEM + rainfall scenario parameters. For planning support, validate against field data.</div>
    `
  }

  downloadResult() {
    if (!this.resultBlob) return
    const a = document.createElement('a')
    a.href = this.resultUrl
    a.download = this.downloadName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  activate() {
    if (!this.mounted) this.mount()
    if (!this.activated) this.ensureSelectionMap()
    setTimeout(() => this.selectionMap?.resize(), 80)
  }
}

/** Sample the land-cover canvas into a code grid for physics. */
function coverCodesFromCanvas(coverCanvas) {
  const res = coverCanvas.width
  const ctx = coverCanvas.getContext('2d', { willReadFrequently: true })
  const data = ctx.getImageData(0, 0, res, res).data
  const codes = new Uint8Array(res * res)
  for (let i = 0; i < res * res; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    // water dark blue-ish, sediment tan, forest dark green, grass green, rock grey, built grey-purple
    if (b > r + 20 && b > g + 10) codes[i] = 0
    else if (r > 150 && g > 135 && b > 100 && r > b) codes[i] = 1
    else if (g > r + 10 && g > b + 10) codes[i] = Math.abs(g - r) > 45 ? 3 : 2
    else if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) codes[i] = 5
    else codes[i] = 4
  }
  return codes
}
