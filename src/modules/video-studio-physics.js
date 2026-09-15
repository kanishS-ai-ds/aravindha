/**
 * ARAVINDHA - DISASTER VIDEO STUDIO
 * Disaster physics: flash-flood (2D diffusive-wave shallow water) and
 * landslide (infinite-slope Factor-of-Safety + depth-averaged Voellmy-Salm
 * debris runout with Hungr-Evans entrainment) solvers on a real DEM grid.
 *
 * All solvers operate on the grid from video-studio-terrain.js and emit
 * per-frame rasters consumed by the cinematic renderer:
 *   - depth raster: Float32Array per frame (meters)
 *   - velocity raster: Float32Array per frame (m/s)
 *
 * Selected model references:
 *  Bates & De Roo (2000) LISFLOOD-FP diffusive-wave approximation
 *  Voellmy-Salm rheology for dense-flow avalanches (RAMMS-style)
 *  Hungr & Evans (2004) entrainment/bulking model
 */

const EPSILON = 1e-6

/* =========================================================
   HYDROLOGY PRE-PROCESSING
========================================================= */

/**
 * Priority-flood depression filling (Wang & Liu 2006) with a binary heap.
 * Returns a filled DEM so hydrologic flow routing works.
 */
export function fillDepressions(dem) {
  const res = dem.res
  const n = res * res
  const filled = new Float32Array(dem.heights)
  const closed = new Uint8Array(n)
  const heap = []

  function push(idx, elev) {
    heap.push({ idx, elev })
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent].elev <= heap[i].elev) break
      const tmp = heap[parent]
      heap[parent] = heap[i]
      heap[i] = tmp
      i = parent
    }
  }

  function pop() {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let smallest = i
        if (l < heap.length && heap[l].elev < heap[smallest].elev) smallest = l
        if (r < heap.length && heap[r].elev < heap[smallest].elev) smallest = r
        if (smallest === i) break
        const tmp = heap[i]
        heap[i] = heap[smallest]
        heap[smallest] = tmp
        i = smallest
      }
    }
    return top
  }

  // Seed heap from boundary cells
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x
      if (x === 0 || y === 0 || x === res - 1 || y === res - 1) {
        push(i, filled[i])
        closed[i] = 1
      }
    }
  }

  const D = [-1, 0, 1, 0, -1, -1, 1, 1]
  const DX = [-1, 0, 1, 0]
  const DY = [0, 1, 0, -1]

  while (heap.length > 0) {
    const cell = pop()
    for (let d = 0; d < 8; d++) {
      const nx = (cell.idx % res) + (d < 4 ? DX[d] : (d === 4 ? -1 : d === 5 ? 1 : d === 6 ? -1 : 1))
      const ny = Math.floor(cell.idx / res) + (d < 4 ? DY[d] : (d === 4 ? -1 : d === 5 ? -1 : d === 6 ? 1 : 1))
      if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue
      const ni = ny * res + nx
      if (closed[ni]) continue
      closed[ni] = 1
      if (filled[ni] <= cell.elev) filled[ni] = cell.elev + EPSILON
      push(ni, filled[ni])
    }
  }

  return { ...dem, heights: filled }
}

/**
 * D8 flow accumulation from a filled DEM.
 * Returns { accumulation: Float32Array (cells), flowDir: Int8Array codes }
 */
export function computeFlowAccumulation(dem) {
  const res = dem.res
  const n = res * res
  const h = dem.heights

  // Slope-based receivers (steepest descent, D8)
  const receiver = new Int32Array(n).fill(-1)
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
  const cell = dem.cellSizeMeters || 30

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x
      let bestSlope = 0
      let bestIdx = -1
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue
        const ni = ny * res + nx
        const dist = d % 4 === 0 || d === 3 || d === 4 || (d > 4 && d % 2 === 1) ? 1 : Math.SQRT2
        const distCorrect = d === 0 || d === 2 || d === 5 || d === 7 ? Math.SQRT2 : 1
        const slope = (h[i] - h[ni]) / (cell * distCorrect)
        if (slope > bestSlope) {
          bestSlope = slope
          bestIdx = ni
        }
      }
      receiver[i] = bestIdx
    }
  }

  // Topological order by elevation (descending) guarantees upstream-first
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[b] - h[a])
  const accumulation = new Float32Array(n).fill(1)
  for (const i of order) {
    const r = receiver[i]
    if (r >= 0) accumulation[r] += accumulation[i]
  }

  return { accumulation, receiver }
}

/** Rough Manning's n from land cover code per cell. */
export function manningFromLandCover(coverGrid) {
  const table = [0.03, 0.026, 0.035, 0.12, 0.05, 0.045] // water, sand, grass, forest, rock, built
  const out = new Float32Array(coverGrid.length)
  for (let i = 0; i < coverGrid.length; i++) {
    out[i] = table[coverGrid[i]] || 0.035
  }
  return out
}

/* =========================================================
   FLASH FLOOD SOLVER
========================================================= */

/**
 * 2D diffusive-wave flood routing.
 * Rainfall is injected each step; water flows downhill, ponds in depressions
 * and converges into channels. Depth (m) and velocity (m/s) rasters per frame.
 */
export async function simulateFlashFlood(dem, coverGrid, opts = {}) {
  const res = dem.res
  const n = res * res
  const cell = dem.cellSizeMeters || 30
  const filled = fillDepressions(dem).heights
  const { accumulation } = computeFlowAccumulation({ ...dem, heights: filled })

  const manning = manningFromLandCover(coverGrid)
  const intensity = Math.max(1, opts.rainfallMmPerHour || 50)
  const durationMin = opts.durationMinutes || 60
  const dt = Math.min(1.0, (cell / 6) * 0.5) // CFL-ish, seconds
  const vCap = (0.35 * cell) / dt // velocity ceiling so fluxes never outrun the timestep
  const stepsPerOutput = Math.max(1, Math.round((durationMin * 60) / opts.outputFrames / dt))
  const runoffCoef = opts.runoffCoefficient || 0.55

  // Depth & velocity states
  const depth = new Float32Array(n)
  const velU = new Float32Array(n)
  const velV = new Float32Array(n)
  const speed = new Float32Array(n)

  // Precompute channel mask (cells with high flow accumulation)
  const chanThreshold = opts.channelThreshold || Math.max(30, n * 0.004)
  const channel = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    channel[i] = accumulation[i] >= chanThreshold ? 1 : 0
  }

  // Discretized boundary: outflow at domain edges
  const frameDepths = []
  const frameSpeeds = []
  const stats = {
    maxDepth: 0,
    peakSpeed: 0,
    peakDischarge: 0,
    timeline: [] // { t, maxDepth, inundated, peakSpeed, discharge }
  }

  const timeStepSeconds = (durationMin * 60) / opts.outputFrames
  let simTime = 0
  const rainRate = (intensity / 1000 / 3600) * runoffCoef // m/s on surface

  for (let f = 0; f < opts.outputFrames; f++) {
    // Yield to the event loop so the UI keeps breathing during long solves.
    if (opts.yieldFn) await opts.yieldFn()
    else await new Promise(r => setTimeout(r, 0))
    const innerSteps = Math.max(2, Math.round(timeStepSeconds / dt))

    for (let s = 0; s < innerSteps; s++) {
      simTime += dt

      // Rainfall
      const rainProfile =
        simTime < durationMin * 60 * 0.35 ? 1 : Math.max(0.15, 1 - (simTime / (durationMin * 60) - 0.35) * 1.2)
      for (let i = 0; i < n; i++) {
        depth[i] += rainRate * rainProfile * dt
      }

      // Stable upwind donor-cell volume-transfer scheme. Flow across each
      // face moves a finite volume from the higher total-head cell to its
      // downhill neighbour, capped by both a velocity CFL limit and a
      // donor-volume fraction. This guarantees positivity and stability
      // (the previous explicit diffusive-wave flux form diverged on steep
      // head gradients).
      const dE = new Float32Array(n)
      const dS = new Float32Array(n)
      velU.fill(0)
      velV.fill(0)
      const donorFrac = 0.22
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const i = y * res + x
          if (x < res - 1) {
            const j = i + 1
            const hFlow = Math.max(depth[i], depth[j])
            if (hFlow > 0.002) {
              const dh = (filled[i] + depth[i]) - (filled[j] + depth[j])
              if (dh > 0) {
                const slope = dh / cell
                const vRaw = (1 / manning[i]) * Math.pow(hFlow, 2 / 3) * Math.sqrt(slope)
                const v = Math.min(vRaw, vCap)
                let dVol = v * hFlow * cell * dt
                dVol = Math.min(dVol, donorFrac * depth[i] * cell * cell)
                if (dVol > 0) {
                  dE[i] = dVol
                  velU[i] = v // donor
                  velU[j] = v // receiver (water arrives moving +x)
                }
              }
            }
          }
          if (y < res - 1) {
            const j = i + res
            const hFlow = Math.max(depth[i], depth[j])
            if (hFlow > 0.002) {
              const dh = (filled[i] + depth[i]) - (filled[j] + depth[j])
              if (dh > 0) {
                const slope = dh / cell
                const vRaw = (1 / manning[i]) * Math.pow(hFlow, 2 / 3) * Math.sqrt(slope)
                const v = Math.min(vRaw, vCap)
                let dVol = v * hFlow * cell * dt
                dVol = Math.min(dVol, donorFrac * depth[i] * cell * cell)
                if (dVol > 0) {
                  dS[i] = dVol
                  velV[i] = v // donor
                  velV[j] = v // receiver (water arrives moving +y)
                }
              }
            }
          }
        }
      }

      // Apply staged transfers (divergence) + boundary bleed.
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const i = y * res + x
          const inW = x > 0 ? dE[i - 1] : 0
          const outE = x < res - 1 ? dE[i] : 0
          const inN = y > 0 ? dS[i - res] : 0
          const outS = y < res - 1 ? dS[i] : 0
          let d = depth[i] + (inW - outE + inN - outS) / (cell * cell)
          // Open-boundary bleed: border cells shed water so it exits the
          // domain instead of ponding at the edge.
          if (x === 0 || y === 0 || x === res - 1 || y === res - 1) d -= d * 0.15 * dt
          depth[i] = isFinite(d) ? Math.max(0, d) : 0
        }
      }

      // Speed magnitude for rendering & stats (from face velocities)
      for (let i = 0; i < n; i++) speed[i] = Math.hypot(velU[i], velV[i])
    }

    // Frame stats
    let maxD = 0
    let inundated = 0
    let pk = 0
    let discharge = 0
    for (let i = 0; i < n; i++) {
      if (depth[i] > maxD) maxD = depth[i]
      if (depth[i] > 0.05) inundated++
      if (speed[i] > pk) pk = speed[i]
      const vMag = Math.min(12, speed[i])
      discharge += depth[i] > 0.02 ? vMag * depth[i] * cell : 0
    }
    stats.timeline.push({
      t: simTime,
      elapsedLabel: formatClock(simTime),
      maxDepth: maxD,
      inundatedCells: inundated,
      inundatedKm2: (inundated * cell * cell) / 1e6,
      peakSpeed: pk,
      dischargeM3s: discharge
    })
    if (maxD > stats.maxDepth) stats.maxDepth = maxD
    if (pk > stats.peakSpeed) stats.peakSpeed = pk
    if (discharge > stats.peakDischarge) stats.peakDischarge = discharge

    frameDepths.push(new Float32Array(depth))
    frameSpeeds.push(new Float32Array(speed))
  }

  return { frameDepths, frameSpeeds, stats, channelMask: channel, accumulation, filled }
}

function formatClock(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

/* =========================================================
   LANDSLIDE SOLVER
========================================================= */

/**
 * Infinite-slope Factor of Safety with pore pressure + optional seismic
 * pseudostatic coefficient (Mohr-Coulomb).
 * FS = [c' + (σn - u) tanφ'] / [τ driving]
 *
 * Accuracy upgrade: soil properties are modulated by terrain convergence
 * (specific catchment area). Real shallow landslides initiate in colluvial
 * hollows — concave, water-converging slopes with deeper, wetter soil — not
 * uniformly across the hillslope. Cells with high upslope contributing area
 * get deeper soil, higher saturation and reduced cohesion; spur/convex cells
 * keep thin, strong, dry soil. This spatially clusters failure at the
 * topographic hollows instead of scattering it on every steep face.
 */
export function computeFactorOfSafety(dem, slopes, opts = {}) {
  const res = dem.res
  const n = res * res
  const cohesion = (opts.cohesionKPa || 14) * 1000 // Pa
  const phi = ((opts.frictionAngle || 30) * Math.PI) / 180
  const gammaDry = opts.soilUnitWeight || 17.5 // kN/m3
  const gammaW = 9.81
  const soilDepth = opts.soilDepthMeters || 2.5
  const baseSaturation = Math.min(1, Math.max(0, (opts.saturationPct || 70) / 100))
  const kh = opts.seismicKh || 0

  // Terrain convergence from D8 flow accumulation (cheap, already used by
  // the flood solver): normalised specific catchment area per cell.
  const { accumulation } = computeFlowAccumulation(dem)
  let accMax = 1
  for (let i = 0; i < n; i++) if (accumulation[i] > accMax) accMax = accumulation[i]
  const logAcc = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    // log-scale: 0 on ridges/spurs, ~1 in valley-head hollows and channels
    logAcc[i] = Math.min(1, Math.log1p(accumulation[i]) / Math.log1p(accMax))
  }

  const fs = new Float32Array(n)
  const tauDrive = new Float32Array(n)
  const shearStrength = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const beta = (Math.max(0.1, slopes[i]) * Math.PI) / 180
    const conv = logAcc[i]
    // Hollows: soil up to 1.6× deeper; spurs: as thin as 0.55×
    const zb = soilDepth * (0.55 + 1.05 * conv)
    // Convergent cells saturate faster as the shared water table rises
    const sat = Math.min(1, baseSaturation * (0.75 + 0.5 * conv))
    const zw = sat * zb
    const sigmaDry = gammaDry * 1000 * (zb - zw)
    const sigmaSat = (gammaDry + 1.0) * 1000 * zw
    const sigmaN = sigmaDry + sigmaSat
    const u = gammaW * 1000 * zw
    // Roots/extra weathering in hollows lower effective cohesion ~30%
    const cPrime = cohesion * (1 - 0.3 * conv)
    const sigmaEff = Math.max(0, sigmaN - u)
    const strength = cPrime + sigmaEff * Math.tan(phi)
    const driving =
      (sigmaDry + sigmaSat) * Math.sin(beta) * Math.cos(beta) +
      kh * gammaDry * 1000 * Math.cos(beta) ** 2
    tauDrive[i] = driving
    shearStrength[i] = strength
    fs[i] = driving > 0 ? strength / driving : 10
  }

  return { fs, tauDrive, shearStrength }
}

/**
 * Depth-averaged Voellmy-Salm debris runout.
 * Failure cells (FS<1) become source mass that accelerates downslope,
 * entrains bed material (Hungr-Evans) and deposits on shallow slopes.
 */
export function simulateLandslide(dem, slopes, fs, opts = {}) {
  const res = dem.res
  const n = res * res
  const cell = dem.cellSizeMeters || 30
  const mu = opts.mu != null ? opts.mu : 0.16
  const xi = opts.xi != null ? opts.xi : 500
  const g = 9.81
  const entrainCoef = opts.entrainment != null ? opts.entrainment : 0.0004
  const stopSlope = opts.depositionSlope || 8
  const dt = Math.min(0.5, cell / 10)

  // Release zone: FS below threshold, clustered near steepest areas
  const fsThreshold = opts.fsThreshold || 1.0
  const release = new Float32Array(n)
  let releaseCells = 0
  for (let i = 0; i < n; i++) {
    if (fs[i] < fsThreshold && slopes[i] > 15) {
      release[i] = (fsThreshold - fs[i]) * (slopes[i] / 45)
      releaseCells++
    }
  }
  // Guarantee a release even in gentle terrain: seed at the steepest decile
  if (releaseCells < 8) {
    const idx = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => slopes[b] - slopes[a]
    )
    for (let k = 0; k < Math.max(4, Math.round(n * 0.004)); k++) {
      release[idx[k]] = 0.35
    }
  }

  // State: debris thickness (m), velocities
  let h = new Float32Array(n)
  const speed = new Float32Array(n)
  for (let i = 0; i < n; i++) h[i] = release[i] * (opts.sourceDepthMeters || 3.5)

  // Bed entrainment: finite per-cell budget (Hungr & Evans style) — each cell
  // can only contribute a limited depth of bed material before it is spent.
  // (Previously entrainment had no memory, so a fast flow re-eroded the same
  // cells every step and volumes grew without bound.)
  const bedErosible0 = new Float32Array(n)
  for (let i = 0; i < n; i++) bedErosible0[i] = slopes[i] > 8 ? 0.6 + slopes[i] / 60 : 0.1
  const bedBudget = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    bedBudget[i] = slopes[i] > 8 ? 0.4 + slopes[i] / 45 : 0.08
  }
  const maxErodePerStep = Math.min(0.08, cell / 400)

  const frameHeights = []
  const frameSpeeds = []
  const stats = {
    maxRunout: 0,
    peakSpeed: 0,
    maxThickness: 0,
    releasedVolume: 0,
    depositedVolume: 0,
    totalMobileVolume: 0,
    timeline: [],
    releaseCellCount: releaseCells
  }

  const frames = opts.outputFrames || 90
  const totalSimSeconds = opts.simSeconds || 90
  const outEvery = Math.max(1, Math.round(totalSimSeconds / frames / dt))
  let simTime = 0

  for (let f = 0; f < frames; f++) {
    for (let s = 0; s < outEvery; s++) {
      simTime += dt

      // Mass-conservative downhill transfer. (The previous version applied
      // outflow with an inverted sign — donors GAINED the mass they sent and
      // receivers were double-drained — so thickness diverged exponentially
      // to Infinity within ~20 frames. This scheme moves a capped volume from
      // each donor to its downhill neighbours; total mass is preserved and
      // can only leave through the domain boundary.)
      const newH = new Float32Array(h)
      const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
      const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
      const DIST = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2]
      const donorFrac = 0.22 // max fraction of a cell's thickness moved per step
      const drops = new Float32Array(8)
      const idxs = new Int32Array(8)

      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const i = y * res + x
          if (h[i] <= 0.01) continue

          // Collect downhill neighbours (positive total-head drop)
          let count = 0
          let dropSum = 0
          let steepest = 0
          for (let d = 0; d < 8; d++) {
            const nx = x + DX[d]
            const ny = y + DY[d]
            if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue
            const ni = ny * res + nx
            const drop = (h[i] + dem.heights[i]) - (h[ni] + dem.heights[ni])
            if (drop > 0) {
              drops[count] = drop
              idxs[count] = ni
              dropSum += drop
              const sTan = drop / (cell * DIST[d])
              if (sTan > steepest) steepest = sTan
              count++
            }
          }
          if (count === 0) continue

          // Voellmy-Salm velocity along the steepest descent
          const cosS = 1 / Math.sqrt(1 + steepest * steepest)
          const fric = mu * g * cosS + (speed[i] * speed[i]) / Math.max(60, xi)
          const accel = g * Math.min(steepest, 2.5)
          const v = Math.max(0, speed[i] + (accel - fric) * dt)
          const vOut = Math.min(v, (0.5 * cell) / dt) // CFL velocity cap

          // Volume to distribute this step (thickness units), donor-capped
          let totalFlux = h[i] * vOut * dt / cell
          const cap = donorFrac * h[i]
          if (totalFlux > cap) totalFlux = cap

          // Split proportionally to head drop; donor loses exactly what
          // receivers gain.
          for (let k = 0; k < count; k++) {
            const share = (drops[k] / dropSum) * totalFlux
            newH[i] -= share
            newH[idxs[k]] += share
          }
        }
      }

      // Entrainment (Hungr-Evans, dt-scaled) + finiteness guard
      for (let i = 0; i < n; i++) {
        let hv = newH[i]
        if (!Number.isFinite(hv)) hv = 0
        hv = Math.max(0, hv)
        if (hv > 0.02 && speed[i] > 1.5 && bedBudget[i] > 0) {
          const want = bedErosible0[i] * entrainCoef * speed[i] * dt
          const eroded = Math.min(want, maxErodePerStep, bedBudget[i])
          hv += eroded
          bedBudget[i] -= eroded
        }
        newH[i] = hv
        speed[i] = Number.isFinite(speed[i]) ? speed[i] * (hv > 0.02 ? 1 : 0.85) : 0
      }

      // Speed update pass using local driving slope
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const i = y * res + x
          if (newH[i] <= 0.02) {
            speed[i] *= 0.85
            continue
          }
          const slopeTan = steepestDrop(dem.heights, res, x, y, cell)
          const fric = mu * g * Math.cos(Math.atan(slopeTan)) + (speed[i] * speed[i]) / Math.max(60, xi)
          speed[i] = Math.max(0, speed[i] + (g * slopeTan - fric) * dt)
          if (slopeTan < Math.tan((stopSlope * Math.PI) / 180) && speed[i] < 0.6) {
            speed[i] = 0
          }
        }
      }

      h = newH
    }

    // Frame stats
    let mobile = 0
    let maxSpeed = 0
    let maxH = 0
    let leadingEdgeDist = 0
    const centerX = res / 2
    for (let i = 0; i < n; i++) {
      if (h[i] > 0.05) {
        mobile += h[i] * cell * cell
        const x = i % res
        const y = Math.floor(i / res)
        const d = Math.hypot(x - centerX, y - res / 2) * cell
        if (d > leadingEdgeDist && h[i] > 0.2) leadingEdgeDist = d
      }
      if (speed[i] > maxSpeed) maxSpeed = speed[i]
      if (h[i] > maxH) maxH = h[i]
    }
    stats.timeline.push({
      t: simTime,
      elapsedLabel: formatClock(simTime),
      mobileVolumeM3: mobile,
      peakSpeed: maxSpeed,
      maxThickness: maxH,
      runoutMeters: leadingEdgeDist
    })
    stats.totalMobileVolume = mobile
    if (leadingEdgeDist > stats.maxRunout) stats.maxRunout = leadingEdgeDist
    if (maxSpeed > stats.peakSpeed) stats.peakSpeed = maxSpeed
    if (maxH > stats.maxThickness) stats.maxThickness = maxH

    frameHeights.push(new Float32Array(h))
    frameSpeeds.push(new Float32Array(speed))
  }

  return { frameHeights, frameSpeeds, stats, releaseMask: release }
}

function steepestDrop(heights, res, x, y, cell) {
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
  let best = 0
  const i = y * res + x
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d]
    const ny = y + DY[d]
    if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue
    const dist = (d === 0 || d === 2 || d === 5 || d === 7) ? Math.SQRT2 : 1
    const drop = (heights[i] - heights[ny * res + nx]) / (cell * dist)
    if (drop > best) best = drop
  }
  return best
}

/* =========================================================
   IMPACT ANALYSIS (buildings, population, evacuation)
========================================================= */

/**
 * Estimate affected structures & population using OSM-derived settlement
 * proxies: built-up land-cover codes + cell footprint heuristics.
 * Real building footprints would need an OSM Overpass query — the caller can
 * inject `buildings` (GeoJSON) to refine counts.
 */
export function analyzeImpacts(simStats, mode, dem, opts = {}) {
  const cell = dem.cellSizeMeters || 30
  const cellArea = cell * cell
  const affected =
    mode === 'flood'
      ? simStats.timeline[simStats.timeline.length - 1]?.inundatedCells || 0
      : simStats.timeline[simStats.timeline.length - 1]?.mobileVolumeM3 > 0
        ? Math.round(simStats.maxRunout / cell) * Math.max(4, Math.round((simStats.totalMobileVolume / (cell * cell * 2)) || 4))
        : 0
  const affectedAreaKm2 = (affected * cellArea) / 1e6

  const popDensity = opts.popDensityPerKm2 || 320
  const buildingDensity = opts.buildingDensityPerKm2 || 48

  const peakDepth = simStats.maxDepth || 0
  const peakSpeed = simStats.peakSpeed || 0
  const severity =
    mode === 'flood' ? Math.min(1, peakDepth / 3) : Math.min(1, peakSpeed / 30)

  const buildingsHit = Math.round(affectedAreaKm2 * buildingDensity * (0.4 + severity))
  const populationExposed = Math.round(affectedAreaKm2 * popDensity)
  const fatalities =
    mode === 'flood'
      ? Math.round(populationExposed * 0.02 * severity)
      : Math.round(populationExposed * 0.06 * severity)

  const flowDist = mode === 'flood' ? peakSpeed * 0.6 : peakSpeed
  const evacWindowMin =
    peakSpeed > 0.5
      ? Math.max(3, Math.round((affectedAreaKm2 > 0 ? 1200 : 800) / Math.max(0.5, flowDist) / 60))
      : 30

  // Guard every exported figure: a diverged solver step (or a corrupt DEM cell)
  // must never leak Infinity/NaN into overlays or toFixed() calls.
  const safe = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback)
  return {
    affectedAreaKm2: Math.max(0, safe(affectedAreaKm2)),
    buildingsAtRisk: Math.max(0, Math.round(safe(buildingsHit))),
    populationExposed: Math.max(0, Math.round(safe(populationExposed))),
    estimatedFatalities: Math.max(0, Math.round(safe(fatalities))),
    severityPct: Math.min(100, Math.max(0, Math.round(safe(severity * 100)))),
    evacuationWindowMin: Math.max(0, Math.round(safe(evacWindowMin, 30))),
    peakDepth: Math.max(0, safe(peakDepth)),
    peakVelocity: Math.max(0, safe(peakSpeed))
  }
}

/* =========================================================
   TIME FORMATTING EXPORT
========================================================= */

export { formatClock }
