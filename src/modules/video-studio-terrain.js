/**
 * ARAVINDHA - DISASTER VIDEO STUDIO
 * Terrain acquisition: bounding-box / pin selection, real DEM (Terrarium PNG tiles)
 * decoding, satellite texture mosaics and land-cover classification.
 *
 * Data sources (free, no key required):
 *  - Elevation: AWS "elevation-tiles-prod" Terrarium PNG tiles (SRTM / NED / EU-DEM
 *    composite by Mapzen / Nextzen). elevation = (R * 256 + G + B / 256) - 32768
 *  - Imagery: Esri World Imagery (satellite) or OSM raster tiles.
 *
 * The module only needs the browser Canvas + fetch APIs, so the whole pipeline runs
 * client-side and works both in the browser and in a desktop wrapper.
 */

/* =========================================================
   CONSTANTS
========================================================= */

export const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export const OSM_TILE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const TERRAIN_TILE_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

const TILE_SIZE = 256

/* =========================================================
   WEB-MERCATOR PROJECTION HELPERS
========================================================= */

export const MERCATOR = {
  lonToX(lon, zoom) {
    return ((lon + 180) / 360) * Math.pow(2, zoom)
  },
  latToY(lat, zoom) {
    const clamped = Math.max(Math.min(lat, 85.05112878), -85.05112878)
    const rad = (clamped * Math.PI) / 180
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  },
  xToLon(x, zoom) {
    return (x / Math.pow(2, zoom)) * 360 - 180
  },
  yToLat(y, zoom) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom)
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  }
}

/** Meters per pixel at a given latitude / zoom for 256px tiles. */
export function metersPerPixel(lat, zoom) {
  return (
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, zoom)
  )
}

/**
 * Choose the DEM zoom so that the grid cell is at least as fine as the
 * desired ground resolution, without exceeding a sane tile count.
 */
export function pickZoomForArea(bbox, targetCellMeters = 30, maxZoom = 13) {
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  for (let z = maxZoom; z >= 5; z--) {
    const mpp = metersPerPixel(midLat, z)
    if (mpp <= targetCellMeters) return z
  }
  return 5
}

export function bboxDimensionsMeters(bbox) {
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const midLon = (bbox.minLon + bbox.maxLon) / 2
  const width =
    Math.abs(bbox.maxLon - bbox.minLon) *
    111320 *
    Math.cos((midLat * Math.PI) / 180)
  const height = Math.abs(bbox.maxLat - bbox.minLat) * 110540
  return { width: Math.round(width), height: Math.round(height), midLat, midLon }
}

/** Expand a pin + radius (meters) into a square bbox. */
export function pinToBbox(lat, lon, radiusMeters) {
  const dLat = radiusMeters / 110540
  const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  return {
    minLon: lon - dLon,
    maxLon: lon + dLon,
    minLat: lat - dLat,
    maxLat: lat + dLat
  }
}

/* =========================================================
   TILE FETCHING
========================================================= */

function tileUrlsForRange(x0, y0, x1, y1, z, urlTemplate) {
  const urls = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const wrappedX = ((x % Math.pow(2, z)) + Math.pow(2, z)) % Math.pow(2, z)
      urls.push({
        x: wrappedX,
        y,
        url: urlTemplate
          .replace('{z}', z)
          .replace('{x}', wrappedX)
          .replace('{y}', y)
      })
    }
  }
  return urls
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Tile failed: ${url}`))
    img.src = url
  })
}

function createTileCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return { canvas, ctx }
}

async function fetchTileRange(x0, y0, x1, y1, z, template, onProgress, label) {
  const urls = tileUrlsForRange(x0, y0, x1, y1, z, template)
  const { canvas, ctx } = createTileCanvas((x1 - x0 + 1) * TILE_SIZE, (y1 - y0 + 1) * TILE_SIZE)
  let done = 0
  let failures = 0

  await Promise.all(
    urls.map(async entry => {
      try {
        const img = await loadImage(entry.url)
        ctx.drawImage(
          img,
          (entry.x - x0) * TILE_SIZE,
          (entry.y - y0) * TILE_SIZE
        )
      } catch (err) {
        failures++
        console.warn(`[video-studio] ${label} tile miss:`, err.message)
      } finally {
        done++
        if (onProgress) {
          onProgress(done / urls.length, `${label} ${done}/${urls.length}`)
        }
      }
    })
  )

  if (failures === urls.length) {
    throw new Error(`All ${label} tiles failed (network offline?)`)
  }
  return { canvas, ctx, failures }
}

/* =========================================================
   ELEVATION GRID (DEM)
========================================================= */

function decodeTerrariumPixel(data, i) {
  return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768
}

/**
 * Fetch a real elevation grid for the bbox.
 * Returns Float32Array heights (meters), row-major, origin = NW corner.
 */
export async function fetchElevationGrid(bbox, gridRes, onProgress) {
  // z14 keeps ~10 m/px at mid-latitudes — noticeably crisper gullies and
  // spur lines than z13, which smooths away the terrain features that
  // control where landslides actually initiate. Small areas (≤ ~3 km) get
  // z15 (~5 m/px) for ridge/sharper-valley detail.
  const dims = bboxDimensionsMeters(bbox)
  const maxZ = dims.width <= 3200 ? 15 : 14
  const zoom = pickZoomForArea(bbox, 12, maxZ)
  const n = Math.pow(2, zoom)
  const x0 = Math.floor(MERCATOR.lonToX(bbox.minLon, zoom))
  const x1 = Math.floor(MERCATOR.lonToX(bbox.maxLon, zoom))
  const y0 = Math.floor(MERCATOR.latToY(bbox.maxLat, zoom))
  const y1 = Math.floor(MERCATOR.latToY(bbox.minLat, zoom))

  const { canvas, ctx, failures } = await fetchTileRange(
    x0, y0, x1, y1, zoom, TERRAIN_TILE_URL, onProgress, 'DEM'
  )

  // Partial tile loss previously slipped through (only 100% failure threw):
  // missing tiles decode as -32768 voids, the void-fill then flattens the
  // whole grid to one elevation, and downstream slope/ML scoring silently
  // reads garbage. Treat >20% tile loss as a failed fetch so callers retry.
  const totalTiles = (x1 - x0 + 1) * (y1 - y0 + 1)
  if (failures > Math.ceil(totalTiles * 0.2)) {
    throw new Error(`DEM incomplete: ${failures}/${totalTiles} tiles failed (network stall)`)
  }

  const pxW = canvas.width
  const pxH = canvas.height
  const img = ctx.getImageData(0, 0, pxW, pxH)
  const data = img.data

  // Global pixel coords of the bbox corners at this zoom
  const pxLeft = MERCATOR.lonToX(bbox.minLon, zoom) * TILE_SIZE - x0 * TILE_SIZE
  const pxRight = MERCATOR.lonToX(bbox.maxLon, zoom) * TILE_SIZE - x0 * TILE_SIZE
  const pyTop = MERCATOR.latToY(bbox.maxLat, zoom) * TILE_SIZE - y0 * TILE_SIZE
  const pyBottom = MERCATOR.latToY(bbox.minLat, zoom) * TILE_SIZE - y0 * TILE_SIZE

  const heights = new Float32Array(gridRes * gridRes)
  for (let gy = 0; gy < gridRes; gy++) {
    const fy = pyTop + ((pyBottom - pyTop) * gy) / (gridRes - 1)
    const pyf = Math.max(0, Math.min(pxH - 1.001, fy))
    const py0 = Math.floor(pyf)
    const py1 = Math.min(pxH - 1, py0 + 1)
    const ty = pyf - py0
    for (let gx = 0; gx < gridRes; gx++) {
      const fx = pxLeft + ((pxRight - pxLeft) * gx) / (gridRes - 1)
      const pxf = Math.max(0, Math.min(pxW - 1.001, fx))
      const px0 = Math.floor(pxf)
      const px1 = Math.min(pxW - 1, px0 + 1)
      const tx = pxf - px0
      // Bilinear sampling — nearest-neighbour produced stair-step slope
      // artefacts that showed up as phantom failure strips on diagonal
      // slopes.
      const i00 = (py0 * pxW + px0) * 4
      const i01 = (py0 * pxW + px1) * 4
      const i10 = (py1 * pxW + px0) * 4
      const i11 = (py1 * pxW + px1) * 4
      const v00 = decodeTerrariumPixel(data, i00)
      const v01 = decodeTerrariumPixel(data, i01)
      const v10 = decodeTerrariumPixel(data, i10)
      const v11 = decodeTerrariumPixel(data, i11)
      const top = v00 + (v01 - v00) * tx
      const bottom = v10 + (v11 - v10) * tx
      heights[gy * gridRes + gx] = top + (bottom - top) * ty
    }
  }

  // Voids: ocean tiles decode to -32768 clusters. In coastal scenes the
  // correct fill is sea level (0 m); inland, voids must become the local
  // land elevation — writing 0 m carves giant flat craters that read as
  // "incomplete terrain" (sheared cliffs and pits in the 3D mesh).
  let validSum = 0
  let validCount = 0
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] > -1000) {
      validSum += heights[i]
      validCount++
    }
  }
  const fillValue = validCount > 0 ? validSum / validCount : 0
  const inland = fillValue > 40 // mean land elevation says this is not a coastal scene
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] <= -1000) heights[i] = inland ? fillValue : 0
  }

  return {
    heights,
    res: gridRes,
    zoom,
    bbox,
    seaLevelFill: fillValue,
    description: `Terrarium DEM z${zoom}`
  }
}

/* =========================================================
   TEXTURE MOSAIC (satellite / street)
========================================================= */

/**
 * Fetch a square texture canvas covering the bbox.
 * `style`: 'satellite' | 'osm'
 */
export async function fetchTextureCanvas(bbox, sizePx, style, onProgress) {
  // Pick a zoom that gives ~sizePx pixels across the bbox for crispness
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const dims = bboxDimensionsMeters(bbox)
  let zoom = 13
  for (let z = 17; z >= 3; z--) {
    const mpp = metersPerPixel(midLat, z)
    if (dims.width / mpp <= sizePx) {
      zoom = z
      break
    }
  }

  const n = Math.pow(2, zoom)
  const x0 = Math.floor(MERCATOR.lonToX(bbox.minLon, zoom))
  const x1 = Math.floor(MERCATOR.lonToX(bbox.maxLon, zoom))
  const y0 = Math.floor(MERCATOR.latToY(bbox.maxLat, zoom))
  const y1 = Math.floor(MERCATOR.latToY(bbox.minLat, zoom))

  const template = style === 'osm' ? OSM_TILE_URL : SATELLITE_TILE_URL
  const { canvas, ctx, failures } = await fetchTileRange(
    x0, y0, x1, y1, zoom, template, onProgress, style === 'osm' ? 'OSM' : 'Imagery'
  )

  // Crop to the exact bbox and resize to a square texture
  const pxLeft = MERCATOR.lonToX(bbox.minLon, zoom) * TILE_SIZE - x0 * TILE_SIZE
  const pxRight = MERCATOR.lonToX(bbox.maxLon, zoom) * TILE_SIZE - x0 * TILE_SIZE
  const pyTop = MERCATOR.latToY(bbox.maxLat, zoom) * TILE_SIZE - y0 * TILE_SIZE
  const pyBottom = MERCATOR.latToY(bbox.minLat, zoom) * TILE_SIZE - y0 * TILE_SIZE

  const out = createTileCanvas(sizePx, sizePx)
  out.ctx.imageSmoothingEnabled = true
  out.ctx.imageSmoothingQuality = 'high'
  out.ctx.drawImage(
    canvas,
    pxLeft, pyTop, Math.max(1, pxRight - pxLeft), Math.max(1, pyBottom - pyTop),
    0, 0, sizePx, sizePx
  )

  return { canvas: out.canvas, zoom, tileFailures: failures }
}

/* =========================================================
   LAND COVER CLASSIFICATION (procedural coloring fallback)
========================================================= */

/**
 * Classify each grid cell into land cover from elevation + slope + imagery,
 * producing an RGBA painted canvas used when no satellite imagery is wanted,
 * or blended underneath a darkened satellite drape for HUD aesthetics.
 * cover codes: 0 water, 1 sand/sediment, 2 grass, 3 forest, 4 rock, 5 built-up
 */
export function classifyLandCover(dem, slopes) {
  const res = dem.res
  const { canvas, ctx } = createTileCanvas(res, res)
  const img = ctx.createImageData(res, res)

  // Elevation histogram quartiles for relative tree-line estimation
  let minE = Infinity
  let maxE = -Infinity
  for (let i = 0; i < dem.heights.length; i++) {
    if (dem.heights[i] < minE) minE = dem.heights[i]
    if (dem.heights[i] > maxE) maxE = dem.heights[i]
  }
  const relief = Math.max(1, maxE - minE)

  const palette = [
    [38, 84, 124], // water
    [168, 152, 116], // sand / sediment
    [86, 124, 58], // grass / agriculture
    [34, 72, 40], // forest
    [124, 118, 110], // rock
    [94, 92, 96] // built-up
  ]

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x
      const e = dem.heights[i]
      const s = slopes ? slopes[i] : 10
      const rel = (e - minE) / relief
      const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1

      let code
      if (e <= 0.5) code = 0
      else if (s < 6 && rel < 0.12) code = 1
      else if (s > 42 || (s > 34 && rel > 0.72)) code = 4
      else if (rel > 0.55 && s > 18) code = 3
      else if (rel < 0.3 && s < 12) code = 2
      else code = noise > 0 ? 3 : 2

      const jitter = 1 + noise * 0.08
      const p = palette[code]
      img.data[i * 4] = Math.min(255, p[0] * jitter)
      img.data[i * 4 + 1] = Math.min(255, p[1] * jitter)
      img.data[i * 4 + 2] = Math.min(255, p[2] * jitter)
      img.data[i * 4 + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Build a hillshade RGBA canvas from the DEM (Lambertian, NW light). */
export function renderHillshade(dem, strength = 0.9) {
  const res = dem.res
  const h = dem.heights
  const { canvas, ctx } = createTileCanvas(res, res)
  const img = ctx.createImageData(res, res)
  const cell = dem.cellSizeMeters || 30

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x
      const xm = Math.max(0, x - 1)
      const xp = Math.min(res - 1, x + 1)
      const ym = Math.max(0, y - 1)
      const yp = Math.min(res - 1, y + 1)
      const dzdx = (h[y * res + xp] - h[y * res + xm]) / (2 * cell)
      const dzdy = (h[yp * res + x] - h[ym * res + x]) / (2 * cell)
      // Light from NW
      const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)
      const az = Math.PI * 1.25
      const alt = Math.PI / 4
      let shade =
        Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect) +
        Math.sin(alt) * Math.cos(slope)
      shade = Math.max(0, Math.min(1, shade))
      const v = Math.round(255 * Math.pow(shade, 1.2) * strength)
      img.data[i * 4] = v
      img.data[i * 4 + 1] = v
      img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Compute slope (degrees) per cell from a DEM grid. */
export function computeSlopes(dem) {
  const res = dem.res
  const h = dem.heights
  const slopes = new Float32Array(res * res)
  const cell = dem.cellSizeMeters || 30
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const xm = Math.max(0, x - 1)
      const xp = Math.min(res - 1, x + 1)
      const ym = Math.max(0, y - 1)
      const yp = Math.min(res - 1, y + 1)
      const dzdx = (h[y * res + xp] - h[y * res + xm]) / (2 * cell)
      const dzdy = (h[yp * res + x] - h[ym * res + x]) / (2 * cell)
      slopes[y * res + x] =
        (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI
    }
  }
  return slopes
}

/** Compose a single drape canvas: imagery + optional hillshade multiply + tint. */
export function composeDrape(landcoverCanvas, imageryCanvas, hillshadeCanvas, opts = {}) {
  const size = landcoverCanvas.width
  const out = createTileCanvas(size, size)
  const ctx = out.ctx

  if (imageryCanvas && !opts.imaginationOnly) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imageryCanvas, 0, 0, size, size)
    // Light cinematic grade only — heavy darkening hid the imagery detail
    // that makes close-ups read as real terrain.
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = 'rgba(10, 16, 22, 0.14)'
    ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'source-over'
  } else {
    ctx.drawImage(landcoverCanvas, 0, 0)
  }

  if (hillshadeCanvas && opts.hillshade) {
    // subtle multi-scale relief shading: strengthens ridges/gullies without
    // flattening the imagery the way a single heavy multiply did
    ctx.globalAlpha = 0.22
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(hillshadeCanvas, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  return out.canvas
}

export const TerrainSources = {
  SATELLITE_TILE_URL,
  OSM_TILE_URL,
  TERRAIN_TILE_URL
}
