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
  CAMERA_PATHS,
  INDIA_REGIONS
} from './video-studio-renderer.js'
import { SimViewer3D } from './sim-viewer-3d.js'

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
            <div class="vs-cfg-row" style="margin-top:10px">
              <label>India Landslide Hotspots — fly to a documented failure zone</label>
              <select id="vsRegion">
                <option value="">— Choose a region / district —</option>
                ${INDIA_REGIONS.map(r => `<option value="${r.id}">${r.name} — ${r.district}, ${r.state} (${r.zone})</option>`).join('')}
              </select>
              <div class="vs-region-note" id="vsRegionNote"></div>
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

              <div class="vs-cfg-row">
                <label>Trigger Mechanism</label>
                <select id="vsTrigger">
                  <option value="rainfall" selected>Extreme rainfall (monsoon cloudburst)</option>
                  <option value="earthquake">Earthquake shaking (M 5.5–6.5)</option>
                  <option value="deforestation">Deforestation — loss of root cohesion</option>
                  <option value="construction">Road cutting / construction loading</option>
                  <option value="combined">Combined: rainfall + seismic + human</option>
                </select>
              </div>

              <div class="vs-cfg-row">
                <label>Weather During Capture</label>
                <select id="vsWeather">
                  <option value="storm" selected>Heavy monsoon storm + lightning</option>
                  <option value="rain">Steady rainfall</option>
                  <option value="clear">Clear skies (aftermath clarity)</option>
                </select>
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
                <label class="vs-check"><input type="checkbox" id="vsInteractive3d" checked /> 🎮 Interactive 3D viewer (orbit the landslide yourself)</label>
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
          <!-- INTERACTIVE 3D VIEWER -->
          <div class="vs-3d-panel" id="vs3dPanel" style="display:none">
            <div class="vs-3d-head">
              <div>
                <div class="vstudio-kicker">INTERACTIVE 3D RECONSTRUCTION</div>
                <h4>Real DEM terrain — drag to orbit, scroll to zoom, right-drag to pan</h4>
              </div>
              <div class="vs-3d-toolbar">
                <button class="vs-3d-btn" id="vs3dPlay" title="Play / pause the landslide">⏸ Pause</button>
                <button class="vs-3d-btn" id="vs3dRestart" title="Restart simulation">↺ Restart</button>
                <select class="vs-3d-btn" id="vs3dSpeed" title="Playback speed">
                  <option value="0.5">0.5×</option>
                  <option value="1" selected>1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
                <span class="vs-3d-sep"></span>
                <button class="vs-3d-btn" data-cam="iso" title="Isometric view">Perspective</button>
                <button class="vs-3d-btn" data-cam="top" title="Top-down">Top</button>
                <button class="vs-3d-btn" data-cam="side" title="Side profile">Side</button>
                <span class="vs-3d-sep"></span>
                <select class="vs-3d-btn" id="vs3dLight">
                  <option value="storm">Monsoon light</option>
                  <option value="day">Midday</option>
                  <option value="dusk">Dusk</option>
                  <option value="night">Night</option>
                </select>
                <select class="vs-3d-btn" id="vs3dWeather">
                  <option value="rain">Rain</option>
                  <option value="storm">Storm</option>
                  <option value="clear">Clear</option>
                </select>
                <span class="vs-3d-sep"></span>
                <label class="vs-3d-exag" title="Terrain vertical exaggeration">Relief ×<strong id="vs3dExagVal">1.4</strong>
                  <input type="range" id="vs3dExag" min="8" max="30" value="14" />
                </label>
                <button class="vs-3d-btn vs-3d-record" id="vs3dRecord" title="Record exactly this camera view to a video">● Record View</button>
              </div>
            </div>
            <div class="vs-3d-container" id="vs3dContainer"></div>
            <div class="vs-3d-hud" id="vs3dHud">
              <span class="chip">SIM TIME <strong id="vs3dHudTime">—</strong></span>
              <span class="chip">RUNOUT <strong id="vs3dHudRunout">—</strong></span>
              <span class="chip">PEAK SPEED <strong id="vs3dHudSpeed">—</strong></span>
              <span class="chip">DEBRIS <strong id="vs3dHudFrame">—</strong></span>
            </div>
          </div>

          <div class="vs-preview-wrap" id="vsPreviewWrap">
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

    // Selection layers attach on style.load — NOT map 'load'. The load event
    // waits for baseline imagery tiles, so on a slow/blocked network the
    // highlight would never appear at all. style.load fires as soon as the
    // style JSON is parsed; the idempotent guard survives re-fires.
    const addDrawLayers = () => {
      if (this.selectionMap.getSource('vs-draw')) {
        this.tempSource = this.selectionMap.getSource('vs-draw')
        return
      }
      this.selectionMap.addSource('vs-draw', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
      // Selection visuals: translucent red fill (the area is *inside* the
      // simulation), solid outline for the committed selection, dashed amber
      // guide for the in-progress rubber band, and vertex dots.
      this.selectionMap.addLayer({
        id: 'vs-draw-fill',
        type: 'fill',
        source: 'vs-draw',
        paint: { 'fill-color': '#ff3b30', 'fill-opacity': 0.22 }
      })
      this.selectionMap.addLayer({
        id: 'vs-draw-line',
        type: 'line',
        source: 'vs-draw',
        filter: ['!=', ['get', 'temp'], true],
        paint: { 'line-color': '#ff5544', 'line-width': 2.6 }
      })
      this.selectionMap.addLayer({
        id: 'vs-draw-temp-line',
        type: 'line',
        source: 'vs-draw',
        filter: ['==', ['get', 'temp'], true],
        paint: { 'line-color': '#ffd166', 'line-width': 2, 'line-dasharray': [2, 1.6] }
      })
      this.selectionMap.addLayer({
        id: 'vs-draw-vertex',
        type: 'circle',
        source: 'vs-draw',
        filter: ['==', ['get', 'vertex'], true],
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#ff5544',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.6
        }
      })
      this.tempSource = this.selectionMap.getSource('vs-draw')
      this.redrawTemp()
    }
    this.selectionMap.on('style.load', addDrawLayers)
    // Repaint whenever the selection source finishes processing an update
    // (covers the async gap between setData and the worker's result).
    this.selectionMap.on('sourcedata', e => {
      if (e.sourceId === 'vs-draw' && e.isSourceLoaded !== false) this.selectionMap.triggerRepaint()
    })

    this.selectionMap.on('click', e => this.handleMapClick(e))
    // Live rubber-band: while the user is mid-draw, keep a translucent
    // preview of the final selection stretched between the first anchor
    // (or polygon chain) and the cursor.
    this.selectionMap.on('mousemove', e => {
      this.hoverPoint = [e.lngLat.lng, e.lngLat.lat]
      if (
        (this.drawMode === 'bbox' && this.drawPoints.length === 1) ||
        (this.drawMode === 'polygon' && this.drawPoints.length >= 1)
      ) {
        this.redrawTemp()
      }
    })
    this.selectionMap.on('mouseout', () => {
      if (this.hoverPoint) {
        this.hoverPoint = null
        this.redrawTemp()
      }
    })
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
      this.setHint('✓ Pin placed — drag the radius slider to resize')
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
        this.hoverPoint = null
        this.redrawTemp()
        this.updateSelectionInfo()
        this.setHint('✓ Area selected — drag the map to inspect, or re-click to redraw')
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
    // Coalesce to one setData per animation frame: mousemove fires far faster
    // than MapLibre's worker can consume updates, and dropped/raced worker
    // updates could leave the selection stale.
    if (this._redrawQueued) return
    this._redrawQueued = true
    requestAnimationFrame(() => {
      this._redrawQueued = false
      this._redrawTempNow()
    })
  }

  _redrawTempNow() {
    if (!this.tempSource) return
    const features = []

    // Committed selection: translucent red highlight + solid outline.
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
      features.push(this.circleFeature(this.selection.pin, this.radiusM))
      features.push({ type: 'Feature', properties: { vertex: true }, geometry: { type: 'Point', coordinates: this.selection.pin } })
    }

    // In-progress drawing: dashed amber guide, live rubber-band preview
    // stretched to the cursor, and a dot on every placed anchor.
    const hover = this.hoverPoint
    if (this.drawMode === 'bbox' && this.drawPoints.length === 1) {
      features.push({ type: 'Feature', properties: { vertex: true }, geometry: { type: 'Point', coordinates: this.drawPoints[0] } })
      if (hover) {
        const [a] = this.drawPoints
        const box = {
          minLon: Math.min(a[0], hover[0]), maxLon: Math.max(a[0], hover[0]),
          minLat: Math.min(a[1], hover[1]), maxLat: Math.max(a[1], hover[1])
        }
        features.push({
          type: 'Feature',
          properties: { temp: true },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [box.minLon, box.minLat], [box.maxLon, box.minLat],
              [box.maxLon, box.maxLat], [box.minLon, box.maxLat], [box.minLon, box.minLat]
            ]]
          }
        })
      }
    }
    if (this.drawMode === 'polygon' && this.drawPoints.length >= 1) {
      const line = hover ? [...this.drawPoints, hover] : [...this.drawPoints]
      if (line.length >= 2) {
        features.push({ type: 'Feature', properties: { temp: true }, geometry: { type: 'LineString', coordinates: line } })
      }
      for (const p of this.drawPoints) {
        features.push({ type: 'Feature', properties: { vertex: true }, geometry: { type: 'Point', coordinates: p } })
      }
    }
    if (this.drawMode === 'pin' && this.drawPoints.length === 1) {
      // radius preview circle
      features.push(this.circleFeature(this.drawPoints[0], this.radiusM))
      features.push({ type: 'Feature', properties: { vertex: true }, geometry: { type: 'Point', coordinates: this.drawPoints[0] } })
    }

    this.tempSource.setData({ type: 'FeatureCollection', features })
    // Force repaints: setData is async (worker round-trip), so repaint once
    // now AND again when the processed data actually lands — with a slow or
    // stalled tile network the map otherwise idles and the new selection
    // never reaches a painted frame.
    this.selectionMap?.triggerRepaint()
  }

  circleFeature([lon, lat], radiusM) {
    const pts = []
    for (let a = 0; a <= 64; a++) {
      const ang = (a / 64) * Math.PI * 2
      const dLat = (radiusM * Math.cos(ang)) / 110540
      const dLon = (radiusM * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180))
      pts.push([lon + dLon, lat + dLat])
    }
    // Closed ring → the translucent fill shows the radius area, the line
    // layer draws its outline.
    return { type: 'Feature', properties: { circle: true }, geometry: { type: 'Polygon', coordinates: [pts] } }
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
    this.hoverPoint = null
    this.redrawTemp()
    this.updateSelectionInfo()
    this.setHint('Click two opposite corners to draw the analysis box')
  }

  loadDemoArea() {
    this.applyRegion('wayanad')
  }

  /**
   * Fly the selection map to a catalogued India landslide hotspot and adopt
   * its curated study bbox as the selection.
   */
  applyRegion(regionId) {
    const r = INDIA_REGIONS.find(x => x.id === regionId)
    const note = document.getElementById('vsRegionNote')
    if (!r) {
      if (note) note.textContent = ''
      return
    }
    this.selectionMap.flyTo({ center: r.center, zoom: r.zoom, pitch: 48, duration: 1800 })
    // Clamp curated bboxes to the DEM acquisition limit (≤ 60 km²) so every
    // region entry is instantly runnable regardless of catalog size.
    const bb = { ...r.bbox }
    const wM = Math.abs(bb.maxLon - bb.minLon) * 111320 * Math.cos((r.center[1] * Math.PI) / 180)
    const hM = Math.abs(bb.maxLat - bb.minLat) * 110540
    const areaKm2 = (wM * hM) / 1e6
    if (areaKm2 > 60) {
      const f = Math.sqrt(60 / areaKm2)
      const cl = (r.center[0] + bb.maxLon + bb.minLon) / 3
      const ca = (r.center[1] + bb.maxLat + bb.minLat) / 3
      bb.minLon = cl + (bb.minLon - cl) * f; bb.maxLon = cl + (bb.maxLon - cl) * f
      bb.minLat = ca + (bb.minLat - ca) * f; bb.maxLat = ca + (bb.maxLat - ca) * f
    }
    this.selection = { type: 'bbox', bbox: bb, region: r }
    this.drawPoints = []
    this.drawMode = 'bbox'
    this.redrawTemp()
    this.updateSelectionInfo()
    if (note) {
      note.innerHTML = `<strong>${r.name}, ${r.state}</strong> — ${r.soil}. ${r.note}.`
      note.style.display = 'block'
    }
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
        this.hoverPoint = null
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
    document.getElementById('vsRegion').addEventListener('change', e => this.applyRegion(e.target.value))
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
      trigger: document.getElementById('vsTrigger').value,
      weather: document.getElementById('vsWeather').value,
      lighting: document.getElementById('vsLighting').value,
      cameraPath: document.getElementById('vsCamera').value,
      videoDurationSec: Number(document.getElementById('vsVideoLen').value),
      resolution: document.getElementById('vsResolution').value,
      format: document.getElementById('vsFormat').value,
      terrainExaggeration: Number(document.getElementById('vsExag').value) / 10,
      showOverlays: document.getElementById('vsOverlays').checked,
      useImagery: document.getElementById('vsImagery').checked,
      interactive3d: document.getElementById('vsInteractive3d')?.checked ?? false,
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
    // Tear down any previous interactive 3D session
    if (this.viewer3d) {
      this.viewer3d.dispose()
      this.viewer3d = null
    }
    this.activateRenderPanel()
    this.setStageRail('render')

    const config = this.readConfig()
    config.locationName = this.selection?.region
      ? `${this.selection.region.name} • ${this.selection.region.district}, ${this.selection.region.state}`
      : 'Selected Area'
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

      const simResult = await this.runPhysics(dem, slopes, cover, config)
      this.setStageUI('physics', 1, this.physicsSummary(config, simResult), 'done')

      const impacts = analyzeImpacts(simResult.stats, config.mode === 'flood' ? 'flood' : 'landslide', dem)

      /* ---------- STAGE 3A: INTERACTIVE 3D VIEWER ---------- */
      if (config.interactive3d) {
        this.setStageUI('render', 0.3, 'Building interactive 3D terrain…', 'active')
        await this.tick()
        this.launchViewer3D(dem, this.drapeCanvas, simResult, config)
        this.setStageUI('render', 1, 'Interactive 3D ready — orbit freely, then “Record View” to export', 'done')
        this.setStageUI('export', 1, 'Press “Record View”, orbit through the landslide, stop — then download', 'done')
        this.setStageRail('export')
        this.renderImpactSummary(impacts, config, simResult)
        return
      }

      /* ---------- STAGE 3: CINEMATIC RENDER ---------- */
      this.setStageUI('render', 0.02, 'Building offscreen 3D terrain scene…', 'active')
      this.renderer = new CinematicVideoRenderer()
      await this.renderer.initMap(bbox, dem, config)
      this.setStageUI('render', 0.15, '3D scene ready — draping disaster fields…', 'active')
      await this.renderer.prepareDisasterDrape(simResult, config.mode === 'flood' ? 'flood' : 'landslide')
      this.renderer.impacts = impacts
      this.renderer.attachDrapeLayer()
      this.renderer.science = this.buildSciencePanel(dem, slopes, this.lastFs, config, simResult)
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

  /* =========================================================
     INTERACTIVE 3D VIEWER (Three.js, free orbit + record)
  ========================================================= */

  launchViewer3D(dem, drapeCanvas, simResult, config) {
    const panel = document.getElementById('vs3dPanel')
    const container = document.getElementById('vs3dContainer')
    const previewWrap = document.getElementById('vsPreviewWrap')
    if (!panel || !container) return
    panel.style.display = 'block'
    if (previewWrap) previewWrap.style.display = 'none'
    container.innerHTML = ''

    this.viewer3d = new SimViewer3D()
    this.viewer3d.build(container, dem, drapeCanvas, {
      verticalExaggeration: config.terrainExaggeration || 1.4,
      lighting: config.lighting || 'storm',
      weather: config.weather === 'clear' ? 'clear' : config.weather || 'rain'
    })
    this.viewer3d.attachSimulation(simResult, dem)
    // Frame the default view on the failure zone for immediate impact
    this.viewer3d.frameOnRelease()
    this.viewer3d.play()

    // HUD updates from the viewer loop
    this.viewer3d.onStats = () => this.updateViewer3dHud()
    this.bindViewer3dToolbar(config)

    // Resize once laid out
    setTimeout(() => this.viewer3d?._onResize(), 60)
    this.setViewer3dPlaying(true)
  }

  bindViewer3dToolbar(config) {
    const v = this.viewer3d
    if (!v) return
    const $ = id => document.getElementById(id)

    $('vs3dPlay').onclick = () => {
      v.toggle()
      this.setViewer3dPlaying(v.playing)
    }
    $('vs3dRestart').onclick = () => {
      v.reset()
      v.play()
      this.setViewer3dPlaying(true)
    }
    $('vs3dSpeed').onchange = e => v.setSpeed(Number(e.target.value))
    document.querySelectorAll('#vs3dPanel [data-cam]').forEach(b => {
      b.onclick = () => v.cameraPreset(b.dataset.cam)
    })
    $('vs3dLight').onchange = e => v.setLighting(e.target.value)
    $('vs3dLight').value = config.lighting || 'storm'
    $('vs3dWeather').onchange = e => v.setWeather(e.target.value)
    $('vs3dWeather').value = config.weather === 'clear' ? 'clear' : 'rain'

    const exag = $('vs3dExag')
    exag.value = Math.round((config.terrainExaggeration || 1.4) * 10)
    $('vs3dExagVal').textContent = (exag.value / 10).toFixed(1)
    exag.oninput = () => {
      $('vs3dExagVal').textContent = (exag.value / 10).toFixed(1)
      v.setVerticalExaggeration(Number(exag.value) / 10)
    }

    $('vs3dRecord').onclick = () => this.toggleViewer3dRecording()
  }

  setViewer3dPlaying(playing) {
    const btn = document.getElementById('vs3dPlay')
    if (btn) btn.textContent = playing ? '⏸ Pause' : '▶ Play'
  }

  updateViewer3dHud() {
    const v = this.viewer3d
    if (!v) return
    const hud = v.getHud()
    const set = (id, val) => {
      const el = document.getElementById(id)
      if (el) el.textContent = val
    }
    set('vs3dHudTime', hud.tLabel || '—')
    set('vs3dHudRunout', hud.runout != null ? `${Math.round(hud.runout)} m` : '—')
    set('vs3dHudSpeed', hud.speed != null ? `${hud.speed.toFixed(1)} m/s` : '—')
    set('vs3dHudFrame', `${Math.floor(v.frameIndex) + 1}/${v.frameCount || 0}`)
  }

  async toggleViewer3dRecording() {
    const v = this.viewer3d
    const btn = document.getElementById('vs3dRecord')
    if (!v || !btn) return
    if (!v.mediaRecorder) {
      v.startRecording(30)
      btn.textContent = '■ Stop Recording'
      btn.classList.add('recording')
      // force playback from start for a clean take
      v.reset()
      v.play()
      this.setViewer3dPlaying(true)
    } else {
      btn.textContent = '● Record View'
      btn.classList.remove('recording')
      const result = await v.stopRecording()
      if (result && result.blob.size > 0) {
        // Reuse the standard export row for the user-captured video
        this.resultBlob = result.blob
        this.resultMime = result.mime
        this.resultUrl = URL.createObjectURL(result.blob)
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        this.downloadName = `aravindha-3d-interactive-${stamp}.${result.ext}`
        const video = document.getElementById('vsPreviewVideo')
        video.src = this.resultUrl
        const wrap = document.getElementById('vsPreviewWrap')
        if (wrap) {
          wrap.style.display = 'block'
          video.style.display = 'block'
          document.getElementById('vsPreviewCanvas').style.display = 'none'
          video.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        document.getElementById('vsExportRow').style.display = 'flex'
        document.getElementById('vsExportMeta').innerHTML =
          `Your camera view • ${(result.blob.size / 1e6).toFixed(1)} MB • ${result.mime.split(';')[0]}`
        this.setStageUI('export', 1, 'Recorded — ready to download', 'done')
      }
    }
  }

  /**
   * Stage 2 orchestrator: factor-of-safety + runout (landslide) or
   * diffusive-wave routing (flood), parameterised by the chosen trigger.
   */
  async runPhysics(dem, slopes, cover, config) {
    if (config.mode === 'flood') {
      return simulateFlashFlood(dem, coverCodesFromCanvas(cover), {
        rainfallMmPerHour: config.rainfallMmPerHour,
        durationMinutes: config.durationMinutes,
        outputFrames: 90
      })
    }
    const trig = this.triggerParams(config)
    const { fs } = computeFactorOfSafety(dem, slopes, trig.fos)
    this.lastFs = fs
    this.setStageUI('physics', 0.35, 'Factor-of-safety computed — running runout dynamics…', 'active')
    await this.tick()
    return simulateLandslide(dem, slopes, fs, trig.runout)
  }

  /** Map the selected trigger to physics parameters + narrative label. */
  triggerParams(config) {
    const base = { saturationPct: config.saturationPct }
    switch (config.trigger) {
      case 'earthquake':
        return {
          fos: { ...base, cohesionKPa: 10, frictionAngle: 28, seismicKh: 0.18, soilDepthMeters: 2.5 },
          runout: { ...base, outputFrames: 90, simSeconds: 90, mu: 0.12, xi: 700 },
          label: 'M 6.0 seismic shaking (kh=0.18)'
        }
      case 'deforestation':
        return {
          fos: { ...base, cohesionKPa: 6, frictionAngle: 30, soilDepthMeters: 1.8 },
          runout: { ...base, outputFrames: 90, simSeconds: 90, mu: 0.2, xi: 380 },
          label: 'Root-cohesion loss after clearing'
        }
      case 'construction':
        return {
          fos: { ...base, cohesionKPa: 12, frictionAngle: 26, soilDepthMeters: 2.2 },
          runout: { ...base, outputFrames: 90, simSeconds: 90, mu: 0.22, xi: 300 },
          label: 'Slope cut + surcharge loading'
        }
      case 'combined':
        return {
          fos: { ...base, cohesionKPa: 8, frictionAngle: 27, seismicKh: 0.12, soilDepthMeters: 2.8 },
          runout: { ...base, outputFrames: 90, simSeconds: 110, mu: 0.13, xi: 650 },
          label: 'Rainfall + seismic + human activity'
        }
      case 'rainfall':
      default:
        return {
          fos: { ...base, cohesionKPa: 14, frictionAngle: 30, soilDepthMeters: 2.5 },
          runout: { ...base, outputFrames: 90, simSeconds: 90, mu: 0.16, xi: 500 },
          label: `${config.rainfallMmPerHour} mm/h cloudburst, ${config.durationMinutes} min`
        }
    }
  }

  physicsSummary(config, simResult) {
    return config.mode === 'flood'
      ? `Done — peak depth ${simResult.stats.maxDepth.toFixed(2)} m, ${simResult.stats.peakSpeed.toFixed(1)} m/s`
      : `Done — runout ${Math.round(simResult.stats.maxRunout)} m @ ${simResult.stats.peakSpeed.toFixed(1)} m/s`
  }

  /**
   * Science annotations for the HUD: slopes, FoS, soil, trigger, risk zoning,
   * evacuation routing — pulled from real DEM + the chosen scenario.
   */
  buildSciencePanel(dem, slopes, fs, config, simResult) {
    const n = slopes.length
    let sum = 0, maxSlope = 0, high = 0, mod = 0
    for (let i = 0; i < n; i++) {
      sum += slopes[i]
      if (slopes[i] > maxSlope) maxSlope = slopes[i]
      if (fs && fs[i] < 1) high++
      else if (fs && fs[i] < 1.5) mod++
    }
    const highPct = Math.round((high / n) * 100)
    const modPct = Math.round((mod / n) * 100)
    const trig = this.triggerParams(config)
    const region = this.selection?.region
    const soil = region?.soil || 'Colluvial soil over bedrock (inferred)'
    let fosMin = null
    if (fs) {
      fosMin = Infinity
      for (let i = 0; i < Math.min(fs.length, 40000); i++) if (fs[i] < fosMin) fosMin = fs[i]
    }
    return {
      meanSlope: sum / n,
      maxSlope,
      fosMin: Number.isFinite(fosMin) ? fosMin : null,
      soil,
      trigger: trig.label,
      highPct,
      modPct,
      lowPct: Math.max(0, 100 - highPct - modPct),
      evac: 'Uphill, perpendicular to the flow axis'
    }
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
