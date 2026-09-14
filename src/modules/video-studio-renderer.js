/**
 * ARAVINDHA - DISASTER VIDEO STUDIO
 * Cinematic 3D video renderer: drives an offscreen MapLibre GL 3D terrain map
 * through scripted camera paths, drapes per-frame disaster fields (flood depth
 * / debris thickness) over real satellite imagery, composites broadcast-style
 * data overlays, and encodes everything to a downloadable video file via
 * MediaRecorder (MP4/H.264 where the browser supports it, WebM/VP9 otherwise).
 */

import * as maplibregl from 'maplibre-gl'
import * as mp4muxer from 'mp4-muxer'
import * as webmMuxer from 'webm-muxer'
import { MERCATOR, composeDrape, classifyLandCover, renderHillshade } from './video-studio-terrain.js'
import { formatClock } from './video-studio-physics.js'

/* =========================================================
   CONFIG PRESETS
========================================================= */

export const RESOLUTIONS = {
  '720p': { width: 1280, height: 720, label: 'HD 720p' },
  '1080p': { width: 1920, height: 1080, label: 'Full HD 1080p' },
  '4k': { width: 3840, height: 2160, label: 'UHD 4K' }
}

export const LIGHTING_PRESETS = {
  day: { sky: '#7fa8d9', horizon: '#cfe0ef', fog: '#b9c9d6', exposure: 1.0, label: 'Midday Clear' },
  storm: { sky: '#3a4654', horizon: '#5a6875', fog: '#4a5560', exposure: 0.72, label: 'Monsoon Storm' },
  dusk: { sky: '#2b3a5c', horizon: '#c2703f', fog: '#54425a', exposure: 0.82, label: 'Dusk / Golden Hour' },
  night: { sky: '#05080f', horizon: '#101828', fog: '#0a0f1a', exposure: 0.5, label: 'Night Ops' }
}

export const CAMERA_PATHS = {
  aerialSweep: { id: 'aerialSweep', label: 'Aerial Sweep', desc: 'High orbit circling the disaster zone' },
  followPath: { id: 'followPath', label: 'Follow Flow Path', desc: 'Low chase along the runout / channel' },
  timeLapse: { id: 'timeLapse', label: 'Time-Lapse Overview', desc: 'Fixed cinematic wide with progressive fields' },
  establishing: { id: 'establishing', label: 'Establishing Push-In', desc: 'Slow zoom from regional to site scale' }
}

/* =========================================================
   COLOR RAMPS
========================================================= */

const FLOOD_RAMP = [
  [0.00, [40, 110, 190, 110]],
  [0.25, [30, 150, 235, 150]],
  [0.50, [40, 200, 235, 175]],
  [0.75, [235, 210, 80, 195]],
  [1.00, [200, 60, 40, 215]]
]

const DEBRIS_RAMP = [
  [0.00, [110, 88, 60, 140]],
  [0.30, [130, 100, 62, 185]],
  [0.60, [88, 66, 44, 215]],
  [1.00, [46, 34, 26, 235]]
]

function rampColor(stops, t) {
  t = Math.max(0, Math.min(1, t))
  for (let s = 0; s < stops.length - 1; s++) {
    const [t0, c0] = stops[s]
    const [t1, c1] = stops[s + 1]
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / Math.max(1e-6, t1 - t0)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
        Math.round(c0[3] + (c1[3] - c0[3]) * f)
      ]
    }
  }
  return stops[stops.length - 1][1]
}

/* =========================================================
   CANVAS HELPERS
========================================================= */

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/* =========================================================
   CINEMATIC RENDERER CLASS
========================================================= */

export class CinematicVideoRenderer {
  constructor() {
    this.map = null
    this.overlayCanvas = null
    this.compositeCanvas = null
    this.drapeBaseCanvas = null
    this.recorder = null
    this.chunks = []
    this.abortRequested = false
    this.onProgress = null
  }

  /**
   * Build the offscreen 3D map for the bbox, centered & fitted.
   */
  async initMap(bbox, dem, opts = {}) {
    const lighting = LIGHTING_PRESETS[opts.lighting] || LIGHTING_PRESETS.day

    const width = Math.min(2048, RESOLUTIONS[opts.resolution]?.width || 1920)
    const height = Math.round(
      width * ((RESOLUTIONS[opts.resolution]?.height || 1080) / (RESOLUTIONS[opts.resolution]?.width || 1920))
    )

    // Must be a <div>: MapLibre appends its own WebGL canvas as a CHILD node,
    // and children of a <canvas> are fallback content the browser never renders.
    // preserveDrawingBuffer (MapLibre v6 lives under canvasContextAttributes) is
    // REQUIRED so drawImage(getCanvas()) reads real pixels instead of a cleared
    // (black) buffer after each compositing pass.
    const container = document.createElement('div')
    container.id = 'vstudio-offscreen-map'
    container.style.width = width + 'px'
    container.style.height = height + 'px'
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    document.body.appendChild(container)

    const centerLon = (bbox.minLon + bbox.maxLon) / 2
    const centerLat = (bbox.minLat + bbox.maxLat) / 2

    this.map = new maplibregl.Map({
      container,
      width,
      height,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      devicePixelRatio: 1, // encode at CSS resolution — huge GPU savings offscreen
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: false },
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
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
        layers: [
          {
            id: 'bg-sat',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-saturation': lighting.exposure < 1 ? -0.2 : 0.05,
              'raster-contrast': 0.12,
              'raster-brightness-max': lighting.exposure,
              'raster-brightness-min': lighting.exposure < 1 ? 0.05 : 0
            }
          }
        ],
        terrain: { source: 'dem', exaggeration: opts.terrainExaggeration || 1.35 },
        sky: {
          'sky-color': lighting.sky,
          'sky-horizon-blend': 0.6,
          'horizon-color': lighting.horizon,
          'horizon-fog-blend': 0.85,
          'fog-color': lighting.fog,
          'fog-ground-blend': 0.75
        },
        light: { anchor: 'viewport', color: '#ffffff', intensity: lighting.exposure < 0.8 ? 0.25 : 0.45 }
      },
      center: [centerLon, centerLat],
      zoom: 13,
      pitch: 55,
      bearing: 0
    })

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 12000) // resolve anyway; tiles may be slow
      this.map.on('load', () => {
        clearTimeout(timer)
        resolve()
      })
      this.map.on('error', () => { /* tolerate tile errors */ })
    })

    // Compute a zoom that fits the bbox
    const dims = { widthM: 0 }
    const midLat = centerLat
    const widthM = Math.abs(bbox.maxLon - bbox.minLon) * 111320 * Math.cos((midLat * Math.PI) / 180)
    this.fitZoom = Math.log2((width * 156543.03392 * Math.cos((midLat * Math.PI) / 180)) / (256 * widthM)) - 0.6

    this.bbox = bbox
    this.dem = dem
    this.compositeCanvas = makeCanvas(width, height)
    this.compositeCtx = this.compositeCanvas.getContext('2d')
    this.overlayCanvas = makeCanvas(width, height)
    this.overlayCtx = this.overlayCanvas.getContext('2d')

    return { width, height }
  }

  /**
   * Pre-render the static disaster drape (max extents) as a raster source layer.
   */
  async prepareDisasterDrape(simResult, mode) {
    const dem = this.dem
    const res = dem.res

    // Build static drape canvas: land cover + hillshade blend
    const cover = classifyLandCover(dem)
    const hill = renderHillshade(dem, 0.85)
    this.drapeBaseCanvas = composeDrape(cover, null, hill, { hillshade: true })

    // Pre-compute max-extent mask colorized
    const maxField = new Float32Array(res * res)
    const frames = mode === 'flood' ? simResult.frameDepths : simResult.frameHeights
    const vmax =
      mode === 'flood'
        ? Math.max(0.5, simResult.stats.maxDepth || 1)
        : Math.max(0.5, simResult.stats.maxThickness || 2)
    for (const f of frames) {
      for (let i = 0; i < f.length; i++) {
        if (f[i] > maxField[i]) maxField[i] = f[i]
      }
    }
    this.maxFieldCanvas = this.rasterizeField(maxField, mode, vmax, dem)
    this.mode = mode
    this.fieldMax = vmax
  }

  /** Render a simulation field into a canvas in grid space. */
  rasterizeField(field, mode, vmax, dem) {
    const res = dem.res
    const c = makeCanvas(res, res)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(res, res)
    const ramp = mode === 'flood' ? FLOOD_RAMP : DEBRIS_RAMP
    for (let i = 0; i < field.length; i++) {
      const v = field[i]
      if (v > 0.02) {
        const col = rampColor(ramp, v / vmax)
        img.data[i * 4] = col[0]
        img.data[i * 4 + 1] = col[1]
        img.data[i * 4 + 2] = col[2]
        img.data[i * 4 + 3] = col[3]
      }
    }
    ctx.putImageData(img, 0, 0)
    return c
  }

  /**
   * Add the current disaster drape frame to the map as a raster layer with
   * per-frame image updates.
   */
  attachDrapeLayer() {
    if (!this.map.getSource('vstudio-disaster')) {
      this.map.addSource('vstudio-disaster', {
        type: 'image',
        url: this.maxFieldCanvas.toDataURL(),
        coordinates: [
          [this.bbox.minLon, this.bbox.maxLat],
          [this.bbox.maxLon, this.bbox.maxLat],
          [this.bbox.maxLon, this.bbox.minLat],
          [this.bbox.minLon, this.bbox.minLat]
        ]
      })
      this.map.addLayer({
        id: 'vstudio-disaster-layer',
        type: 'raster',
        source: 'vstudio-disaster',
        paint: { 'raster-opacity': 0.82, 'raster-fade-duration': 0 }
      })
    } else {
      this.map.getSource('vstudio-disaster').updateImage({
        url: this.maxFieldCanvas.toDataURL(),
        coordinates: [
          [this.bbox.minLon, this.bbox.maxLat],
          [this.bbox.maxLon, this.bbox.maxLat],
          [this.bbox.maxLon, this.bbox.minLat],
          [this.bbox.minLon, this.bbox.minLat]
        ]
      })
    }
  }

  updateDrapeFrame(frameCanvas) {
    const src = this.map.getSource('vstudio-disaster')
    if (!src) return
    src.updateImage({
      url: frameCanvas.toDataURL(),
      coordinates: [
        [this.bbox.minLon, this.bbox.maxLat],
        [this.bbox.maxLon, this.bbox.maxLat],
        [this.bbox.maxLon, this.bbox.minLat],
        [this.bbox.minLon, this.bbox.minLat]
      ]
    })
  }

  /* =========================================================
     CAMERA PATHS
  ========================================================= */

  cameraPose(pathId, t /* 0..1 */, bbox) {
    const centerLon = (bbox.minLon + bbox.maxLon) / 2
    const centerLat = (bbox.minLat + bbox.maxLat) / 2
    const spanLon = bbox.maxLon - bbox.minLon
    const spanLat = bbox.maxLat - bbox.minLat

    switch (pathId) {
      case 'aerialSweep': {
        const angle = t * Math.PI * 2 + 0.6
        const r = 0.55
        return {
          center: [centerLon + Math.cos(angle) * spanLon * r * 0.18, centerLat + Math.sin(angle) * spanLat * r * 0.18],
          zoom: this.fitZoom + 0.4,
          pitch: 62,
          bearing: (angle * 180) / Math.PI
        }
      }
      case 'followPath': {
        // Diagonal traverse from uphill corner to downhill corner
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        return {
          center: [bbox.minLon + spanLon * (0.2 + 0.6 * ease), bbox.maxLat - spanLat * (0.2 + 0.6 * ease)],
          zoom: this.fitZoom + 1.6,
          pitch: 72,
          bearing: 45 + 30 * Math.sin(t * Math.PI)
        }
      }
      case 'timeLapse':
        return {
          center: [centerLon, centerLat - spanLat * 0.08],
          zoom: this.fitZoom - 0.3,
          pitch: 42,
          bearing: -12 + Math.sin(t * Math.PI) * 8
        }
      case 'establishing':
      default: {
        const ease = 1 - Math.pow(1 - t, 3)
        return {
          center: [centerLon, centerLat],
          zoom: this.fitZoom - 1.6 + ease * 1.9,
          pitch: 30 + ease * 34,
          bearing: -25 + ease * 40
        }
      }
    }
  }

  /**
   * Wait for the map to go idle, bounded by a timeout so an already-idle map
   * (or a zero-duration jump that emits no fresh idle event) can never hang.
   */
  mapIdle(timeoutMs = 4000) {
    return new Promise(resolve => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        this.map && this.map.off('idle', finish)
        resolve()
      }
      const timer = setTimeout(finish, timeoutMs)
      if (this.map) this.map.once('idle', finish)
      else finish()
    })
  }

  /**
   * Wait until the map has painted fresh frame(s). 'render' fires on every
   * completed WebGL pass — much faster and more reliable than 'idle', which
   * can stall for seconds while satellite/DEM tiles settle over the network.
   * Two rendered passes guarantee the compositor has a complete frame.
   */
  waitForPaintedFrames(count = 2, timeoutMs = 5000) {
    return new Promise(resolve => {
      let seen = 0
      let done = false
      const finish = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        this.map && this.map.off('render', onRender)
        resolve()
      }
      const onRender = () => {
        seen++
        if (seen >= count) finish()
      }
      const timer = setTimeout(finish, timeoutMs)
      if (this.map) this.map.on('render', onRender)
      else finish()
    })
  }

  async applyCamera(pose, jump = false) {
    const map = this.map
    if (jump || !pose.duration) {
      map.jumpTo(pose)
      // MapLibre renders on demand: after a static jump it may emit exactly one
      // render pass (or none, when tiles are cached). triggerRepaint guarantees
      // fresh painted frames for the handshake below instead of stalling until
      // the watchdog timeout on every frame.
      map.triggerRepaint()
      // One completed render pass = one fully painted frame (preserveDrawingBuffer
      // keeps it readable). Deterministic and fast.
      await this.waitForPaintedFrames(1, 1500)
    } else {
      map.easeTo(pose)
      await this.waitForPaintedFrames(1, pose.duration + 1500)
    }
  }

  /* =========================================================
     HUD OVERLAY
  ========================================================= */

  drawOverlay(ctx, W, H, frameInfo) {
    const { mode, simTimeLabel, stats, impacts, frameIdx, totalFrames, config, timeline } = frameInfo

    ctx.clearRect(0, 0, W, H)

    // Vignette
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.42)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Top bar
    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)'
    ctx.fillRect(0, 0, W, 64)
    ctx.fillStyle = '#e8382f'
    ctx.fillRect(0, 0, 6, 64)

    ctx.fillStyle = '#ffffff'
    ctx.font = `800 ${Math.round(H * 0.028)}px Inter, sans-serif`
    ctx.textBaseline = 'middle'
    const modeLabel = mode === 'flood' ? 'FLASH FLOOD SIMULATION' : 'LANDSLIDE SIMULATION'
    ctx.fillText(modeLabel, 24, 26)
    ctx.fillStyle = '#9fb0c0'
    ctx.font = `600 ${Math.round(H * 0.018)}px Inter, sans-serif`
    ctx.fillText(
      `ARAVINDHA GEO-PULSE • ${config.locationName || 'Selected Area'} • ${LIGHTING_PRESETS[config.lighting]?.label || ''}`,
      24,
      47
    )

    // Right top: LIVE / T+ clock
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ff5544'
    ctx.font = `900 ${Math.round(H * 0.024)}px Inter, sans-serif`
    ctx.fillText(`● T+ ${simTimeLabel}`, W - 24, 26)
    ctx.fillStyle = '#8fa2b5'
    ctx.font = `600 ${Math.round(H * 0.015)}px Inter, sans-serif`
    ctx.fillText(`FRAME ${frameIdx + 1}/${totalFrames}`, W - 24, 47)
    ctx.textAlign = 'left'

    // Metric chips
    const chips = []
    if (mode === 'flood') {
      chips.push({ k: 'MAX DEPTH', v: `${(stats.maxDepth || 0).toFixed(2)} m` })
      chips.push({ k: 'PEAK FLOW', v: `${(stats.peakSpeed || 0).toFixed(1)} m/s` })
      chips.push({ k: 'DISCHARGE', v: `${Math.round(stats.dischargeM3s || 0).toLocaleString()} m³/s` })
      chips.push({ k: 'INUNDATED', v: `${(timeline?.inundatedKm2 || 0).toFixed(2)} km²` })
    } else {
      chips.push({ k: 'RUNOUT', v: `${Math.round(timeline?.runoutMeters || 0).toLocaleString()} m` })
      chips.push({ k: 'PEAK SPEED', v: `${(timeline?.peakSpeed || 0).toFixed(1)} m/s` })
      chips.push({ k: 'MOBILE MASS', v: `${Math.round((timeline?.mobileVolumeM3 || 0) / 1000).toLocaleString()}k m³` })
      chips.push({ k: 'THICKNESS', v: `${(timeline?.maxThickness || 0).toFixed(1)} m` })
    }

    let chipX = 24
    const chipY = H - 118
    ctx.font = `700 ${Math.round(H * 0.016)}px Inter, sans-serif`
    for (const chip of chips) {
      const w = ctx.measureText(`${chip.k}  ${chip.v}`).width + 34
      ctx.fillStyle = 'rgba(8, 12, 18, 0.72)'
      ctx.beginPath()
      ctx.roundRect(chipX, chipY, w, 40, 8)
      ctx.fill()
      ctx.fillStyle = '#6fb4e0'
      ctx.fillText(chip.k, chipX + 14, chipY + 14)
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 ${Math.round(H * 0.019)}px Inter, sans-serif`
      ctx.fillText(chip.v, chipX + 14, chipY + 30)
      chipX += w + 10
      ctx.font = `700 ${Math.round(H * 0.016)}px Inter, sans-serif`
    }

    // Impact panel (bottom right)
    if (impacts && config.showImpacts !== false) {
      const pw = Math.round(W * 0.24)
      const ph = 148
      const px = W - pw - 24
      const py = H - ph - 24
      ctx.fillStyle = 'rgba(8, 12, 18, 0.78)'
      ctx.beginPath()
      ctx.roundRect(px, py, pw, ph, 12)
      ctx.fill()
      ctx.fillStyle = '#e8382f'
      ctx.fillRect(px, py, 4, ph)

      ctx.fillStyle = '#9fb0c0'
      ctx.font = `800 ${Math.round(H * 0.014)}px Inter, sans-serif`
      ctx.fillText('IMPACT ASSESSMENT', px + 18, py + 20)

      const rows = [
        ['Population exposed', impacts.populationExposed.toLocaleString()],
        ['Buildings at risk', impacts.buildingsAtRisk.toLocaleString()],
        ['Affected area', `${impacts.affectedAreaKm2.toFixed(2)} km²`],
        ['Evacuation window', `${impacts.evacuationWindowMin} min`]
      ]
      let ry = py + 46
      for (const [k, v] of rows) {
        ctx.fillStyle = '#71828f'
        ctx.font = `600 ${Math.round(H * 0.015)}px Inter, sans-serif`
        ctx.fillText(k, px + 18, ry)
        ctx.fillStyle = '#ffd166'
        ctx.font = `800 ${Math.round(H * 0.016)}px Inter, sans-serif`
        ctx.textAlign = 'right'
        ctx.fillText(v, px + pw - 16, ry)
        ctx.textAlign = 'left'
        ry += 26
      }
    }

    // Severity watermark
    if (impacts) {
      ctx.fillStyle = `rgba(232, 56, 47, ${0.10 + 0.5 * (impacts.severityPct / 100) * 0.2})`
      ctx.font = `900 ${Math.round(H * 0.14)}px Inter, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText(`${impacts.severityPct}%`, W - 30, H * 0.32)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = `800 ${Math.round(H * 0.022)}px Inter, sans-serif`
      ctx.fillText('SEVERITY', W - 30, H * 0.40)
      ctx.textAlign = 'left'
    }

    // Progress timeline strip
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(0, H - 6, W, 6)
    ctx.fillStyle = mode === 'flood' ? '#2fa8e0' : '#c47a3a'
    ctx.fillRect(0, H - 6, (frameIdx / totalFrames) * W, 6)
  }

  /* =========================================================
     RECORD + EXPORT
  ========================================================= */

  pickMimeType(prefer) {
    const candidates =
      prefer === 'mp4'
        ? ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
        : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
    }
    return ''
  }

  /**
   * Choose the best encoder available. WebCodecs gives exact per-frame
   * timestamps (deterministic duration & speed, no wall-clock coupling);
   * MediaRecorder is the fallback but timestamps captures by wall clock.
   */
  async pickEncoder(format, W, H, fps, bitrate) {
    const wantMp4 = format === 'mp4'
    if (typeof VideoEncoder !== 'undefined') {
      const candidates = wantMp4
        ? [
            { codec: 'avc1.640033', muxer: 'mp4', mime: 'video/mp4' }, // High 5.1 (4K-capable)
            { codec: 'avc1.64002a', muxer: 'mp4', mime: 'video/mp4' }, // High 4.2 (1080p)
            { codec: 'avc1.640028', muxer: 'mp4', mime: 'video/mp4' } // High 4.0
          ]
        : [
            { codec: 'vp09.00.51.08', muxer: 'webm', mime: 'video/webm;codecs=vp9' },
            { codec: 'vp09.00.10.08', muxer: 'webm', mime: 'video/webm;codecs=vp9' }
          ]
      for (const c of candidates) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: c.codec,
            width: W,
            height: H,
            bitrate,
            framerate: fps
          })
          if (support.supported) return { kind: 'webcodecs', ...c }
        } catch (e) { /* try next */ }
      }
    }
    const mime = this.pickMimeType(wantMp4 ? 'mp4' : 'webm')
    if (mime) return { kind: 'mediarecorder', muxer: mime.includes('mp4') ? 'mp4' : 'webm', mime }
    return { kind: 'mediarecorder', muxer: 'webm', mime: 'video/webm' }
  }

  async recordVideo(opts) {
    const { fps, durationSec, cameraPath, mode, simResult, config, onFrame, onProgress } = opts
    const W = this.compositeCanvas.width
    const H = this.compositeCanvas.height
    const totalFrames = Math.round(fps * durationSec)
    const framesInSim = mode === 'flood' ? simResult.frameDepths.length : simResult.frameHeights.length
    const bitrate = { '720p': 8e6, '1080p': 16e6, '4k': 55e6 }[config.resolution] || 16e6
    const encoder = await this.pickEncoder(config.format, W, H, fps, bitrate)

    /* ---- Capture sink ------------------------------------------------ */
    let sink
    if (encoder.kind === 'webcodecs') {
      const Target = encoder.muxer === 'mp4' ? mp4muxer.ArrayBufferTarget : webmMuxer.ArrayBufferTarget
      const MuxerCtor = encoder.muxer === 'mp4' ? mp4muxer.Muxer : webmMuxer.Muxer
      const muxer = new MuxerCtor({
        target: new Target(),
        video: encoder.muxer === 'mp4'
          ? { codec: 'avc', width: W, height: H, frameRate: fps }
          : { codec: 'V_VP9', width: W, height: H, frameRate: fps },
        ...(encoder.muxer === 'mp4' ? { fastStart: 'in-memory' } : {}),
        firstTimestampBehavior: 'offset'
      })
      const enc = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => console.error('[video-studio] encoder error:', e)
      })
      enc.configure({
        codec: encoder.codec,
        width: W,
        height: H,
        bitrate,
        framerate: fps,
        ...(encoder.muxer === 'mp4' ? { avc: { format: 'avc' } } : {})
      })
      const frameDurUs = 1e6 / fps
      const gop = fps * 2
      sink = {
        kind: 'webcodecs',
        async writeFrame(canvas, frame) {
          if (enc.encodeQueueSize > 4) {
            await new Promise(r => setTimeout(r, 12))
          }
          // VideoFrame(canvas) breaks on some 2D canvases — go via ImageBitmap.
          const bmp = await createImageBitmap(canvas, { alpha: 'discard' })
          const vf = new VideoFrame(bmp, {
            timestamp: Math.round((frame * 1e6) / fps),
            duration: Math.round(frameDurUs)
          })
          enc.encode(vf, { keyFrame: frame % gop === 0 })
          vf.close()
          bmp.close()
        },
        async finish() {
          await enc.flush()
          muxer.finalize()
          return {
            blob: new Blob([muxer.target.buffer], { type: encoder.mime }),
            mime: encoder.mime,
            ext: encoder.muxer === 'mp4' ? 'mp4' : 'webm'
          }
        },
        abort() {
          try { enc.close() } catch (e) { /* noop */ }
        }
      }
    } else {
      const stream = this.compositeCanvas.captureStream(0)
      const track = stream.getVideoTracks()[0]
      this.chunks = []
      this.recorder = new MediaRecorder(stream, { mimeType: encoder.mime, videoBitsPerSecond: bitrate })
      this.recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data)
      }
      const finished = new Promise(resolve => {
        this.recorder.onstop = resolve
      })
      this.recorder.start()
      const frameInterval = 1000 / fps
      const startWall = performance.now()
      sink = {
        kind: 'mediarecorder',
        async writeFrame(_canvas, frame) {
          // Pace captures on the realtime schedule; MediaRecorder stamps by wall clock.
          const wait = startWall + frame * frameInterval - performance.now()
          if (wait > 4) await new Promise(r => setTimeout(r, wait))
          if (track.requestFrame) track.requestFrame()
          else if (stream.requestFrame) stream.requestFrame()
        },
        finish: async () => {
          await new Promise(r => setTimeout(r, 120))
          await finished
          stream.getTracks().forEach(t => t.stop())
          return {
            blob: new Blob(this.chunks, { type: encoder.mime || 'video/webm' }),
            mime: encoder.mime || 'video/webm',
            ext: (encoder.mime || '').includes('mp4') ? 'mp4' : 'webm'
          }
        },
        abort: () => {
          try { this.recorder.stop() } catch (e) { /* noop */ }
        }
      }
    }

    /* ---- Pre-render per-frame field canvases (grid-space) ------------- */
    const frameCanvases = []
    for (let f = 0; f < framesInSim; f++) {
      const field = mode === 'flood' ? simResult.frameDepths[f] : simResult.frameHeights[f]
      const vmax =
        mode === 'flood'
          ? Math.max(0.5, simResult.stats.maxDepth || 1)
          : Math.max(0.5, simResult.stats.maxThickness || 2)
      frameCanvases.push(this.rasterizeField(field, mode, vmax, this.dem))
    }

    /* ---- Cinematic frame loop ----------------------------------------- */
    for (let frame = 0; frame < totalFrames; frame++) {
      if (this.abortRequested) break

      const t = frame / (totalFrames - 1)
      const pose = this.cameraPose(cameraPath, t, this.bbox)
      await this.applyCamera(pose)

      // Advance disaster field
      const fieldFrame = Math.min(framesInSim - 1, Math.floor(t * framesInSim))
      if (frame % Math.max(1, Math.round(totalFrames / framesInSim / 2)) === 0 || frame === totalFrames - 1) {
        this.updateDrapeFrame(frameCanvases[fieldFrame])
        await this.mapIdle(4000)
      }

      // Composite map + overlay: terrain is painted into the composite canvas
      // first, the HUD is drawn on a separate transparent layer, then the two
      // are stacked. drawOverlay() starts with clearRect() — painting it
      // straight onto the composite would erase the terrain every frame.
      const mapCanvas = this.map.getCanvas()
      this.compositeCtx.drawImage(mapCanvas, 0, 0, W, H)

      const timeline =
        simResult.stats.timeline[Math.min(simResult.stats.timeline.length - 1, fieldFrame)]

      this.drawOverlay(this.overlayCtx, W, H, {
        mode,
        simTimeLabel: timeline?.elapsedLabel || formatClock(t * (mode === 'flood' ? (config.durationMinutes || 60) * 60 : (config.simSeconds || 90))),
        stats: simResult.stats,
        impacts: this.impacts,
        frameIdx: frame,
        totalFrames,
        config,
        timeline
      })
      this.compositeCtx.drawImage(this.overlayCanvas, 0, 0)

      await sink.writeFrame(this.compositeCanvas, frame)

      if (onFrame) onFrame(frame, totalFrames)
      if (onProgress) onProgress((frame + 1) / totalFrames)
    }

    const result = await sink.finish()
    // MediaRecorder blob carries the encoder mime; WebCodecs path already set it.
    return result
  }

  abort() {
    this.abortRequested = true
  }

  destroy() {
    if (this.map) {
      try {
        this.map.remove()
      } catch (e) { /* noop */ }
      this.map = null
    }
    const el = document.getElementById('vstudio-offscreen-map')
    if (el) el.remove()
  }
}

export { MERCATOR }
