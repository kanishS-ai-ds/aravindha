/**
 * ARAVINDHA - INTERACTIVE 3D LANDSLIDE SIMULATION VIEWER
 * A real-3D (Three.js) reconstruction of the selected geographic area:
 *   - terrain mesh built from the actual fetched DEM (Terrarium tiles)
 *   - satellite imagery draped as texture, hillshade lit scene
 *   - landslides played back from the physics engine's debris fields as a
 *     deforming 3D surface (scar, flow lobes, deposition) + flying boulders
 *   - volumetric dust burst on failure, rain, fog, sky, free orbit camera
 *   - one-click video recording of exactly what the user orbits/zooms
 *
 * Everything runs client-side. The terrain is a PlaneGeometry whose Z
 * attribute is displaced by real elevation meters (scaled to world units);
 * the debris overlay is a second grid mesh whose vertices lift/drop every
 * frame according to the solver's thickness field, so the flow visibly
 * scours the release zone and accumulates at the runout toe.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/* =========================================================
   RENDER MODES
========================================================= */

export const VIEWER_MODES = {
  HYBRID: 'hybrid', // satellite drape + lit mesh (default, realistic)
  SATELLITE: 'satellite', // pure imagery drape
  ANALYSIS: 'analysis' // elevation/slope tint, no imagery
}

/* =========================================================
   MAIN VIEWER CLASS
========================================================= */

export class SimViewer3D {
  constructor() {
    this.renderer = null
    this.scene = null
    this.camera = null
    this.controls = null
    this.terrainMesh = null
    this.debrisMesh = null
    this.boulderGroup = null
    this.dustSprites = null
    this.rainPoints = null
    this.waterMesh = null
    this.markerGroup = null
    this.mounted = false
    this.playing = false
    this.simTime = 0 // seconds of simulated disaster time
    this.timeScale = 1
    this.loopPlayback = true
    this.rafId = null
    this.mediaRecorder = null
    this.recordingChunks = []
    this.onStats = null
    this._clock = new THREE.Clock()
  }

  /* ---------------------------------------------------------
     BUILD SCENE
  --------------------------------------------------------- */

  /**
   * @param {HTMLElement|CanvasRenderingContext2D} container DOM node to render into
   * @param {object} dem { heights: Float32Array, res, cellSizeMeters }
   * @param {HTMLCanvasElement} drapeCanvas satellite/landcover drape (res x res)
   * @param {object} opts { mode, verticalExaggeration, lighting, weather }
   */
  build(container, dem, drapeCanvas, opts = {}) {
    this.dispose()

    this.dem = dem
    this.opts = opts
    this.mode = opts.mode || VIEWER_MODES.HYBRID
    this.lighting = opts.lighting || 'storm'
    this.weather = opts.weather || 'rain'

    const res = dem.res
    const cell = dem.cellSizeMeters || 30
    this.cell = cell

    // --- height stats & world scaling -----------------------------------
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < dem.heights.length; i++) {
      const v = dem.heights[i]
      if (v < minH) minH = v
      if (v > maxH) maxH = v
    }
    this.relief = Math.max(1, maxH - minH)
    this.minH = minH
    this.maxH = maxH
    // world units: 1 unit = 1 meter horizontally; vertical scaled by exaggeration
    this.vertScale = (opts.verticalExaggeration || 1.35)
    // keep the scene a manageable size: clamp horizontal extent to ~2km world units
    this.worldScale = 2000 / Math.max(res * cell, 800)

    // --- three basics -----------------------------------------------------
    this.scene = new THREE.Scene()
    const skyColor = this._skyColor()
    this.scene.background = new THREE.Color(skyColor)
    this.scene.fog = new THREE.FogExp2(skyColor, this._fogDensity())

    const width = container.clientWidth || 960
    const height = container.clientHeight || 540
    this.camera = new THREE.PerspectiveCamera(55, width / Math.max(1, height), 1, 30000)
    this.camera.position.set(res * cell * this.worldScale * 0.7, this.relief * this.vertScale * this.worldScale * 1.1, res * cell * this.worldScale * 0.7)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = this._exposure()
    container.appendChild(this.renderer.domElement)
    this.domElement = this.renderer.domElement
    this.domElement.style.width = '100%'
    this.domElement.style.height = '100%'
    this.domElement.style.display = 'block'

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.maxPolarAngle = Math.PI / 2.05
    this.controls.minDistance = 20
    this.controls.maxDistance = res * cell * this.worldScale * 2.2
    this.controls.target.set(0, this.relief * this.vertScale * this.worldScale * 0.35, 0)

    // --- lights ------------------------------------------------------------
    this.scene.add(new THREE.HemisphereLight(0xbfd4e8, 0x3a4238, 0.75))
    // soft sky fill so shadow-facing slopes stay readable (not pitch black)
    const fill = new THREE.DirectionalLight(0x9ab8d8, 0.55)
    fill.position.set(0.3, 0.6, 1).normalize()
    this.scene.add(fill)
    const sun = new THREE.DirectionalLight(0xfff3dd, this.lighting === 'night' ? 0.15 : 1.15)
    sun.position.set(-1, 1.4, 0.6).normalize().multiplyScalar(res * cell * this.worldScale)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const halfW = (res * cell * this.worldScale) / 2
    Object.assign(sun.shadow.camera, { left: -halfW, right: halfW, top: halfW, bottom: -halfW, near: 10, far: halfW * 6 })
    this.scene.add(sun)
    this.sun = sun

    // --- terrain mesh ------------------------------------------------------
    this._buildTerrain(dem, drapeCanvas)

    // --- disaster layers (built later when physics result attached) --------
    this._buildDebris()
    this._buildBoulders()
    this._buildDust()
    this._buildRain()
    this._buildWater()

    // --- failure-zone pin marker ------------------------------------------
    this._buildMarker()

    this.mounted = true
    this._animate()
    window.addEventListener('resize', this._onResize)
  }

  _skyColor() {
    switch (this.lighting) {
      case 'day': return 0x9ec7ea
      case 'dusk': return 0x3c3550
      case 'night': return 0x060a12
      default: return 0x46525f // storm
    }
  }

  _exposure() {
    switch (this.lighting) {
      case 'day': return 1.05
      case 'dusk': return 0.85
      case 'night': return 0.55
      default: return 1.08
    }
  }

  _fogDensity() {
    switch (this.lighting) {
      case 'day': return 0.00012
      case 'dusk': return 0.00016
      case 'night': return 0.0002
      default: return 0.00022
    }
  }

  _buildTerrain(dem, drapeCanvas) {
    const res = dem.res
    const cell = this.cell
    const geo = new THREE.PlaneGeometry(
      res * cell * this.worldScale,
      res * cell * this.worldScale,
      res - 1,
      res - 1
    )
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position
    for (let gy = 0; gy < res; gy++) {
      for (let gx = 0; gx < res; gx++) {
        const vi = gy * res + gx
        const h = dem.heights[vi]
        pos.setY(vi, (h - this.minH) * this.vertScale * this.worldScale)
      }
    }
    geo.computeVertexNormals()

    // vertex colors from drape canvas (satellite pixels / analysis tint)
    let drapeData = null
    if (drapeCanvas) {
      const c = document.createElement('canvas')
      c.width = res; c.height = res
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(drapeCanvas, 0, 0, res, res)
      drapeData = ctx.getImageData(0, 0, res, res).data
    }
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      let r, g, b
      if (drapeData && this.mode !== VIEWER_MODES.ANALYSIS) {
        r = drapeData[i * 4] / 255
        g = drapeData[i * 4 + 1] / 255
        b = drapeData[i * 4 + 2] / 255
      } else {
        const rel = (dem.heights[i] - this.minH) / this.relief
        // hypsometric tint: valley green -> slope brown -> crest grey
        r = 0.22 + rel * 0.5
        g = 0.42 + rel * 0.18
        b = 0.24 + rel * 0.4
      }
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.02,
      flatShading: false
    })
    this.terrainMesh = new THREE.Mesh(geo, mat)
    this.terrainMesh.receiveShadow = true
    this.terrainMesh.castShadow = true
    this.scene.add(this.terrainMesh)

    // Skirt walls: drop every border vertex straight down to the pedestal
    // top so the terrain edge always meets the geological block. Without this
    // the raised rim floats above the pedestal and the camera sees a black
    // gap under the terrain sheet (the "incomplete terrain" screenshot).
    const skirtDepth = Math.max(2, (this.relief * this.vertScale * this.worldScale) * 0.04)
    const edgeWorld = (res * cell * this.worldScale) / 2
    const rimColor = new THREE.Color(0x4a3a2a) // weathered rock face
    const skirtPositions = []
    const skirtColors = []
    const rimSample = new Float32Array(res)
    // Walk the four border loops: N row, S row, W col, E col. Each segment
    // becomes a vertical quad from terrain height down to skirtDepth below 0.
    const emitSkirt = (idxA, idxB) => {
      const hA = pos.getY(idxA)
      const hB = pos.getY(idxB)
      const xA = pos.getX(idxA), zA = pos.getZ(idxA)
      const xB = pos.getX(idxB), zB = pos.getZ(idxB)
      // quad = A(top) B(top) B(bottom) A(bottom)
      skirtPositions.push(xA, hA, zA, xB, hB, zB, xB, -skirtDepth, zB, xA, -skirtDepth, zA)
      for (let k = 0; k < 4; k++) skirtColors.push(rimColor.r, rimColor.g, rimColor.b)
    }
    for (let gx = 0; gx < res - 1; gx++) emitSkirt(gx, gx + 1) // north
    const baseS = (res - 1) * res
    for (let gx = 0; gx < res - 1; gx++) emitSkirt(baseS + gx, baseS + gx + 1) // south
    for (let gy = 0; gy < res - 1; gy++) emitSkirt(gy * res, (gy + 1) * res) // west
    for (let gy = 0; gy < res - 1; gy++) emitSkirt(gy * res + res - 1, (gy + 1) * res + res - 1) // east
    const skirtGeo = new THREE.BufferGeometry()
    const skirtPosArr = new Float32Array(skirtPositions)
    skirtGeo.setAttribute('position', new THREE.BufferAttribute(skirtPosArr, 3))
    skirtGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skirtColors), 3))
    const index = []
    for (let q = 0; q < skirtPosArr.length / 12; q++) {
      const v = q * 4
      // winding per side handled by DoubleSide — this is a static rim
      index.push(v, v + 1, v + 2, v, v + 2, v + 3)
    }
    skirtGeo.setIndex(index)
    skirtGeo.computeVertexNormals()
    const skirtMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
    const skirt = new THREE.Mesh(skirtGeo, skirtMat)
    skirt.receiveShadow = true
    this.scene.add(skirt)

    // cross-section pedestal (geological block look, like the reference image)
    const depth = Math.max(60, this.relief * 0.45) * this.worldScale
    const pedestalGeo = new THREE.BoxGeometry(
      res * cell * this.worldScale, depth, res * cell * this.worldScale
    )
    const pedestalMats = []
    const strata = ['#5a4232', '#6e5440', '#3d2c20', '#8a6d52']
    for (let i = 0; i < 6; i++) {
      if (i === 2 || i === 3) {
        pedestalMats.push(new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 }))
      } else {
        // simple layered rock texture via tiny canvas
        const c = document.createElement('canvas')
        c.width = 64; c.height = 128
        const g2 = c.getContext('2d')
        for (let s = 0; s < 6; s++) {
          g2.fillStyle = strata[s % strata.length]
          g2.fillRect(0, s * 22, 64, 20)
        }
        const tex = new THREE.CanvasTexture(c)
        pedestalMats.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }))
      }
    }
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMats)
    // Pedestal top must sit exactly at y=0 (the DEM min-height plane) so the
    // skirt walls land on it — a hidden seam here read as a floating map.
    pedestal.position.y = -depth / 2 + 0.01
    this.scene.add(pedestal)
  }

  /* ---------------------------------------------------------
     DISASTER LAYERS
  --------------------------------------------------------- */

  _buildDebris() {
    const res = this.dem.res
    const geo = new THREE.PlaneGeometry(
      this.dem.res * this.cell * this.worldScale,
      this.dem.res * this.cell * this.worldScale,
      res - 1,
      res - 1
    )
    geo.rotateX(-Math.PI / 2)
    // give it slightly larger extent via polygonOffset so no z-fighting
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
      transparent: true,
      opacity: 0.97,
      emissive: 0x33261a,
      emissiveIntensity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    })
    this.debrisMesh = new THREE.Mesh(geo, mat)
    this.debrisMesh.visible = false
    this.debrisMesh.castShadow = true
    this.scene.add(this.debrisMesh)
  }

  _buildBoulders() {
    this.boulderGroup = new THREE.Group()
    this.boulderGroup.visible = false
    this.scene.add(this.boulderGroup)
    this.boulders = []
  }

  _buildDust() {
    this.dustSprites = []
    this.dustGroup = new THREE.Group()
    this.scene.add(this.dustGroup)
  }

  _buildRain() {
    const count = 2600
    const positions = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    const half = this.dem.res * this.cell * this.worldScale * 0.62
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * half * 2
      positions[i * 3 + 1] = Math.random() * (this.relief * this.vertScale * this.worldScale + 400)
      positions[i * 3 + 2] = (Math.random() - 0.5) * half * 2
      speed[i] = 260 + Math.random() * 180
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xaec6de,
      size: 2.6,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    })
    this.rainPoints = new THREE.Points(geo, mat)
    this.rainPoints.visible = this.weather !== 'clear'
    this.rainSpeed = speed
    this.scene.add(this.rainPoints)
  }

  _buildWater() {
    const size = this.dem.res * this.cell * this.worldScale
    const geo = new THREE.PlaneGeometry(size, size, 1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a6d8f,
      transparent: true,
      opacity: 0.55,
      roughness: 0.08,
      metalness: 0.5
    })
    this.waterMesh = new THREE.Mesh(geo, mat)
    this.waterMesh.visible = false
    this.scene.add(this.waterMesh)
  }

  _buildMarker() {
    this.markerGroup = new THREE.Group()
    const ringGeo = new THREE.RingGeometry(26, 36, 40)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4433, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    this.markerGroup.add(ring)
    const pinGeo = new THREE.ConeGeometry(6, 26, 12)
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xff4433, emissive: 0x661411 })
    const pin = new THREE.Mesh(pinGeo, pinMat)
    pin.rotation.x = Math.PI
    pin.position.y = 30
    this.markerGroup.add(pin)
    this.markerGroup.visible = false
    this.scene.add(this.markerGroup)
  }

  /**
   * Attach physics output and pre-bake per-frame geometry updates.
   * @param {object} simResult { frameHeights, frameSpeeds, stats, releaseMask }
   * @param {object} dem source DEM used by the solver
   */
  attachSimulation(simResult, dem) {
    this.simResult = simResult
    // Landslides carry frameHeights (debris thickness); floods carry
    // frameDepths (water depth). Treat both as a scalar "flow field".
    this.fieldKind = simResult.frameHeights ? 'debris' : 'flood'
    this.frames = simResult.frameHeights || simResult.frameDepths
    this.frameCount = this.frames.length
    this.frameIndex = 0
    this.simTime = 0

    const res = dem.res
    this.debrisRes = res

    // Per-frame debris surface: heights scaled to world units; also track the
    // leading-edge cell for boulder spawning.
    this.debrisMax = 0.001
    for (const f of this.frames) {
      for (let i = 0; i < f.length; i++) {
        const v = f[i]
        if (Number.isFinite(v) && v > this.debrisMax) this.debrisMax = v
      }
    }
    // Peak speed across all frames, for colour normalisation (guard NaN)
    this.debrisSpeedMax = 1
    if (simResult.frameSpeeds) {
      for (const f of simResult.frameSpeeds) {
        for (let i = 0; i < f.length; i++) {
          const v = f[i]
          if (Number.isFinite(v) && v > this.debrisSpeedMax) this.debrisSpeedMax = v
        }
      }
    }

    // find release-zone centroid for camera / boulders / marker
    let sx = 0, sy = 0, sw = 0
    const mask = simResult.releaseMask || this.frames[0]
    for (let i = 0; i < mask.length; i++) {
      const w = Math.min(1, mask[i] * 10)
      sx += (i % res) * w
      sy += Math.floor(i / res) * w
      sw += w
    }
    this.releaseCentroid = sw > 0
      ? { x: (sx / sw), y: (sy / sw) }
      : { x: res / 2, y: res / 2 }

    // place marker at release centroid
    this._placeMarkerAt(this.releaseCentroid.x, this.releaseCentroid.y)

    // spawn boulders at release zone (landslides only — water has no boulders)
    if (this.fieldKind === 'debris') {
      this._spawnBoulders()
      this.boulderGroup.visible = true
    }

    // Track where the mass actually went: debris-weighted centroid of the
    // final frame gives the runout target for smart framing.
    const last = this.frames[this.frames.length - 1]
    let fx = 0, fy = 0, fw = 0
    for (let i = 0; i < last.length; i++) {
      const w = last[i]
      if (w > 0.1) {
        fx += (i % res) * w
        fy += Math.floor(i / res) * w
        fw += w
      }
    }
    this.flowCentroid = fw > 0
      ? { x: fx / fw, y: fy / fw }
      : this.releaseCentroid

    this.debrisMesh.visible = true
    this._applyDebrisFrame(0)
  }

  _gridToWorld(gx, gy) {
    const res = this.dem.res
    const size = this.dem.res * this.cell * this.worldScale
    return {
      x: (gx / (res - 1) - 0.5) * size,
      z: (gy / (res - 1) - 0.5) * size
    }
  }

  _terrainY(gx, gy) {
    const res = this.dem.res
    const x0 = Math.max(0, Math.min(res - 1, Math.round(gx)))
    const y0 = Math.max(0, Math.min(res - 1, Math.round(gy)))
    return (this.dem.heights[y0 * res + x0] - this.minH) * this.vertScale * this.worldScale
  }

  _placeMarkerAt(gx, gy) {
    const { x, z } = this._gridToWorld(gx, gy)
    this.markerGroup.position.set(x, this._terrainY(gx, gy) + 1, z)
    this.markerGroup.visible = true
  }

  _spawnBoulders() {
    // clear old
    for (const b of this.boulders) {
      this.boulderGroup.remove(b.mesh)
      b.mesh.geometry.dispose()
      b.mesh.material.dispose()
    }
    this.boulders = []
    if (!this.frames.length) return

    const res = this.dem.res
    const count = Math.min(70, Math.max(24, Math.round(res * 0.3)))
    // Build a weighted list of release-zone cells so boulders originate where
    // the slope actually fails — scattered rocks over the whole mountain were
    // a sampling artifact (the old rejection sampler accepted almost any cell
    // after 24 tries and dotted the entire peak with stones).
    const mask = this.simResult.releaseMask
    const pool = []
    if (mask) {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 0.01) pool.push(i)
      }
    }
    for (let i = 0; i < count; i++) {
      let gx, gy
      if (pool.length > 0) {
        const ci = pool[Math.floor(Math.random() * pool.length)]
        gx = ci % res
        gy = Math.floor(ci / res)
      } else {
        gx = Math.floor(Math.random() * res)
        gy = Math.floor(Math.random() * res)
      }
      const size = 6 + Math.random() * 16
      const geo = new THREE.DodecahedronGeometry(size, 0)
      const shade = 0.35 + Math.random() * 0.2
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shade * 0.9, shade * 0.75, shade * 0.6),
        roughness: 0.95,
        flatShading: true
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      const { x, z } = this._gridToWorld(gx, gy)
      mesh.position.set(x, this._terrainY(gx, gy) + size, z)
      this.boulderGroup.add(mesh)
      this.boulders.push({
        mesh,
        gx, gy,
        active: false,
        vel: new THREE.Vector3(),
        size,
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      })
    }
  }

  /**
   * Push one solver frame into the 3D debris surface.
   */
  _applyDebrisFrame(frameIdx) {
    if (!this.frames || !this.frames.length) return
    const f = this.frames[Math.min(this.frames.length - 1, frameIdx)]
    const res = this.debrisRes
    const pos = this.debrisMesh.geometry.attributes.position
    const col = this.debrisMesh.geometry.attributes.color
    const size = this.dem.res * this.cell * this.worldScale

    if (!col) {
      const colors = new Float32Array(pos.count * 3)
      this.debrisMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    const colors = this.debrisMesh.geometry.attributes.color

    const ramp = this.fieldKind === 'flood'
      ? t => {
          // water ramp: shallow cyan -> deep blue (matches FLOOD_RAMP feel)
          const r = 0.16 + 0.7 * t
          const g = 0.43 + 0.35 * t
          const b = 0.75 + 0.1 * t
          return [r, g, b]
        }
      : t => {
          // debris ramp: bright tan -> saturated dark chocolate, high contrast
          // against the dark-green satellite drape so the flow reads clearly.
          const r = 0.93 - 0.33 * t
          const g = 0.76 - 0.42 * t
          const b = 0.5 - 0.32 * t
          return [r, g, b]
        }

    // floods render as a flatter sheet (deep solver cells would otherwise
    // spike into tall vertical walls); debris keeps the chunky relief.
    // Floods also get a 3x3 box blur — isolated deep cells surrounded by dry
    // land render as thin pyramids otherwise.
    const liftScale = this.fieldKind === 'flood' ? this.relief * 0.04 : this.relief * 0.085
    let field = f
    if (this.fieldKind === 'flood' && !this._smoothBuf) {
      this._smoothBuf = new Float32Array(f.length)
    }
    if (this.fieldKind === 'flood') {
      const s = this._smoothBuf
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          let sum = 0, cnt = 0
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy
            if (yy < 0 || yy >= res) continue
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx
              if (xx < 0 || xx >= res) continue
              sum += f[yy * res + xx]
              cnt++
            }
          }
          s[y * res + x] = sum / cnt
        }
      }
      field = s
    }
    let maxVisible = 0
    // Speed field for the same frame (may be absent in old results) —
    // fast-moving debris renders darker/wetter, slow debris dries lighter.
    const spd = this.simResult?.frameSpeeds?.[Math.min(frameIdx, (this.simResult?.frameSpeeds?.length || 1) - 1)]
    const spdNorm = this.debrisSpeedMax || 1
    for (let gy = 0; gy < res; gy++) {
      for (let gx = 0; gx < res; gx++) {
        const vi = gy * res + gx
        const th = field[vi]
        const baseY = this._terrainY(gx, gy)
        const lift = (th / this.debrisMax) * liftScale * this.vertScale
        pos.setY(vi, baseY + lift + 0.4)
        if (th > 0.05) {
          let [r, g, b] = ramp(Math.min(1, th / this.debrisMax))
          if (spd) {
            // up to 35% darkening at the fast wet front
            const s = Math.min(1, spd[vi] / spdNorm)
            const dark = 1 - 0.35 * s
            r *= dark; g *= dark; b *= dark
          }
          colors.setXYZ(vi, r, g, b)
          if (th > maxVisible) maxVisible = th
        } else {
          colors.setXYZ(vi, 0, 0, 0)
        }
      }
    }
    // hide empty cells via alpha map trick: use transparent material with alpha from thickness
    pos.needsUpdate = true
    colors.needsUpdate = true
    this.debrisMesh.geometry.computeVertexNormals()

    // alpha: fade out cells below a small threshold — rebuild alpha from thickness
    this._updateDebrisAlpha(field, res)

    // boulders: activate progressively, roll downhill
    this._updateBoulders(f, res, frameIdx)

    this._lastMaxVisible = maxVisible
  }

  _updateDebrisAlpha(f, res) {
    // Build an alpha-map canvas at grid res: white where debris exists.
    if (!this._alphaCanvas) {
      this._alphaCanvas = document.createElement('canvas')
      this._alphaCanvas.width = res
      this._alphaCanvas.height = res
      this._alphaCtx = this._alphaCanvas.getContext('2d')
      this._alphaTex = new THREE.CanvasTexture(this._alphaCanvas)
      this.debrisMesh.material.alphaMap = this._alphaTex
      this.debrisMesh.material.transparent = true
    }
    const img = this._alphaCtx.createImageData(res, res)
    let any = false
    for (let i = 0; i < f.length; i++) {
      const a = f[i] > 0.05 ? 235 : 0
      img.data[i * 4] = a
      img.data[i * 4 + 1] = a
      img.data[i * 4 + 2] = a
      img.data[i * 4 + 3] = 255
      if (a) any = true
    }
    this._alphaCtx.putImageData(img, 0, 0)
    this._alphaTex.needsUpdate = true
    this.debrisMesh.visible = any
  }

  _updateBoulders(f, res, frameIdx) {
    if (this.fieldKind !== 'debris' || !this.boulders) return
    const activation = frameIdx / Math.max(1, this.frames.length - 1)
    const g = 9.81 * this.worldScale
    for (let i = 0; i < this.boulders.length; i++) {
      const b = this.boulders[i]
      if (!b.active) {
        // stagger activation through the slide
        if (activation > 0.02 + (i / this.boulders.length) * 0.5) b.active = true
        else continue
      }
      // sample slope gradient in grid space, convert to world acceleration
      const eps = 1
      const dhx = this._terrainY(b.gx + eps, b.gy) - this._terrainY(b.gx - eps, b.gy)
      const dhz = this._terrainY(b.gx, b.gy + eps) - this._terrainY(b.gx, b.gy - eps)
      const cellW = this.cell * this.worldScale * eps
      b.vel.x -= (dhx / (2 * cellW)) * g * 0.016
      b.vel.z -= (dhz / (2 * cellW)) * g * 0.016
      b.vel.multiplyScalar(0.965) // friction

      const worldPerCell = (this.dem.res * this.cell * this.worldScale) / (res - 1)
      b.gx += (b.vel.x * 0.016) / worldPerCell
      b.gy += (b.vel.z * 0.016) / worldPerCell

      // clamp inside domain
      b.gx = Math.max(1, Math.min(res - 2, b.gx))
      b.gy = Math.max(1, Math.min(res - 2, b.gy))

      const { x, z } = this._gridToWorld(b.gx, b.gy)
      const ground = this._terrainY(b.gx, b.gy)
      const debrisY = (f[Math.round(b.gy) * res + Math.round(b.gx)] / this.debrisMax) * this.relief * 0.06 * this.vertScale

      // A boulder only rides ON the debris surface while the flow around it
      // is still moving. Once the local flow slows below ~1.5 m/s the boulder
      // settles INTO the deposit — buried rocks don't float on a settled
      // hillside (the scattered "floating stones" artifact).
      const localH = f[Math.round(b.gy) * res + Math.round(b.gx)] || 0
      const localSpeed = (this.simResult.frameSpeeds?.[Math.min(frameIdx, this.simResult.frameSpeeds.length - 1)] || [])[Math.round(b.gy) * res + Math.round(b.gx)] || 0
      if (localH > 0.05 && localSpeed > 1.5) {
        const targetY = Math.max(ground, ground + debrisY) + b.size * 0.55
        b.mesh.position.set(x, targetY, z)
        b.mesh.rotation.x += b.spin.x * 0.1
        b.mesh.rotation.z += b.spin.z * 0.1
      } else {
        // settle: sink to ~55% below the deposit surface (partially buried)
        const targetY = ground + debrisY * 0.4 + b.size * 0.18
        const cur = b.mesh.position.y
        b.mesh.position.set(x, cur + (targetY - cur) * 0.12, z)
      }
    }
  }

  _emitDustBurst(frameIdx) {
    if (!this.dustGroup) return
    // dust plumes are a debris-flow phenomenon — floods emit none
    if (this.fieldKind !== 'debris') return
    const res = this.dem.res
    const maxFrames = this.frames.length
    // dust bursts where debris is fast: sample a few high-speed cells per frame
    const speeds = this.simResult.frameSpeeds[frameIdx]
    for (let k = 0; k < 3; k++) {
      const ci = Math.floor(Math.random() * speeds.length)
      if (speeds[ci] > 4) {
        const gx = ci % res
        const gy = Math.floor(ci / res)
        const { x, z } = this._gridToWorld(gx, gy)
        const y = this._terrainY(gx, gy)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          color: 0x9a8a72,
          transparent: true,
          opacity: 0.55,
          depthWrite: false
        }))
        const s = 30 + Math.random() * 60
        sprite.scale.set(s, s, s)
        sprite.position.set(x, y + 12, z)
        this.dustGroup.add(sprite)
        this.dustSprites.push({ sprite, life: 1 })
      }
    }
    void maxFrames
  }

  _updateDust(dt) {
    for (let i = this.dustSprites.length - 1; i >= 0; i--) {
      const d = this.dustSprites[i]
      d.life -= dt * 0.8
      d.sprite.position.y += dt * 12
      const s = d.sprite.scale.x * (1 + dt * 0.9)
      d.sprite.scale.set(s, s, s)
      d.sprite.material.opacity = Math.max(0, d.life * 0.5)
      if (d.life <= 0) {
        this.dustGroup.remove(d.sprite)
        d.sprite.material.dispose()
        this.dustSprites.splice(i, 1)
      }
    }
  }

  _updateRain(dt) {
    if (!this.rainPoints.visible) return
    const pos = this.rainPoints.geometry.attributes.position
    const topY = this.relief * this.vertScale * this.worldScale + 400
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - this.rainSpeed[i] * dt
      if (y < 0) y = topY * (0.7 + Math.random() * 0.3)
      pos.setY(i, y)
    }
    pos.needsUpdate = true
  }

  /* ---------------------------------------------------------
     PLAYBACK
  --------------------------------------------------------- */

  play() {
    if (!this.frames || !this.frames.length) return
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  seek(fraction) {
    if (!this.frames || !this.frames.length) return
    this.frameIndex = Math.floor(fraction * (this.frames.length - 1))
    this.simTime = (fraction) * (this.simResult.stats.timeline.at(-1)?.t || this.frameCount)
    this._applyDebrisFrame(this.frameIndex)
    this._updateTimeHud()
  }

  reset() {
    this.frameIndex = 0
    this.simTime = 0
    this.seek(0)
  }

  setSpeed(scale) {
    this.timeScale = scale
  }

  setMode(mode) {
    this.mode = mode
    if (this.terrainMesh) this.terrainMesh.material.needsUpdate = true
    this._rebuildTerrainColors()
  }

  _rebuildTerrainColors() {
    if (!this.terrainMesh || !this.drapeDataOriginal) return
  }

  setLighting(preset) {
    this.lighting = preset
    if (this.scene) {
      this.scene.background = new THREE.Color(this._skyColor())
      this.scene.fog.color = new THREE.Color(this._skyColor())
      this.scene.fog.density = this._fogDensity()
      this.renderer.toneMappingExposure = this._exposure()
      this.sun.intensity = preset === 'night' ? 0.15 : preset === 'dusk' ? 0.95 : 1.15
      const fill = this.scene.children.find(o => o.isDirectionalLight && o !== this.sun)
      if (fill) fill.intensity = preset === 'night' ? 0.12 : 0.55
    }
  }

  setWeather(kind) {
    this.weather = kind
    if (this.rainPoints) this.rainPoints.visible = kind !== 'clear'
    this.scene.fog.density = kind === 'storm' ? 0.0003 : this._fogDensity()
  }

  setVerticalExaggeration(scale) {
    this.vertScale = scale
    // full rebuild of terrain Y + debris re-application
    const res = this.dem.res
    const pos = this.terrainMesh.geometry.attributes.position
    for (let gy = 0; gy < res; gy++) {
      for (let gx = 0; gx < res; gx++) {
        pos.setY(gy * res + gx, (this.dem.heights[gy * res + gx] - this.minH) * scale * this.worldScale)
      }
    }
    pos.needsUpdate = true
    this.terrainMesh.geometry.computeVertexNormals()
    if (this.frames) this._applyDebrisFrame(this.frameIndex)
  }

  focusOnRelease() {
    if (!this.releaseCentroid) return
    const { x, z } = this._gridToWorld(this.releaseCentroid.x, this.releaseCentroid.y)
    this.controls.target.set(x, this._terrainY(this.releaseCentroid.x, this.releaseCentroid.y), z)
  }

  /**
   * Cinematic default framing: three-quarter aerial centred between the
   * release scar and the final runout centroid, so the whole failure path
   * fits in frame from the first second.
   */
  frameOnRelease() {
    const extent = this.dem.res * this.cell * this.worldScale
    let tx = 0, tz = 0
    if (this.releaseCentroid && this.flowCentroid) {
      const a = this._gridToWorld(this.releaseCentroid.x, this.releaseCentroid.y)
      const b = this._gridToWorld(this.flowCentroid.x, this.flowCentroid.y)
      tx = (a.x + b.x) / 2
      tz = (a.z + b.z) / 2
    }
    const groundY = this.relief * this.vertScale * this.worldScale * 0.32
    this.controls.target.set(tx, groundY, tz)
    this.camera.position.set(
      tx - extent * 0.5,
      this.relief * this.vertScale * this.worldScale * 1.05,
      tz + extent * 0.58
    )
    this.controls.update()
  }

  /* ---------------------------------------------------------
     CAMERA PRESETS
  --------------------------------------------------------- */

  cameraPreset(which) {
    const extent = this.dem.res * this.cell * this.worldScale
    const target = this.controls.target.clone()
    const peak = this.relief * this.vertScale * this.worldScale
    let newPos
    switch (which) {
      case 'top':
        newPos = new THREE.Vector3(target.x, peak * 2.6, target.z + 1)
        break
      case 'side':
        newPos = new THREE.Vector3(target.x + extent * 0.85, peak * 0.45, target.z)
        break
      case 'iso':
      default:
        newPos = new THREE.Vector3(
          target.x + extent * 0.55,
          peak * 1.15,
          target.z + extent * 0.55
        )
    }
    this.camera.position.copy(newPos)
    this.controls.update()
  }

  /* ---------------------------------------------------------
     RECORDING (records the live canvas while user orbits)
  --------------------------------------------------------- */

  startRecording(fps = 30) {
    if (this.mediaRecorder) return
    const stream = this.domElement.captureStream(fps)
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
    this.recordingChunks = []
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 })
    this.mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this.recordingChunks.push(e.data)
    }
    this.mediaRecorder.start()
    this.recordingMime = mime
  }

  stopRecording() {
    return new Promise(resolve => {
      if (!this.mediaRecorder) return resolve(null)
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordingChunks, { type: this.recordingMime })
        this.mediaRecorder = null
        resolve({ blob, mime: this.recordingMime, ext: this.recordingMime.includes('mp4') ? 'mp4' : 'webm' })
      }
      this.mediaRecorder.stop()
    })
  }

  /* ---------------------------------------------------------
     INTERNAL LOOP
  --------------------------------------------------------- */

  _animate = () => {
    this.rafId = requestAnimationFrame(this._animate)
    const dt = Math.min(0.05, this._clock.getDelta())

    if (this.playing && this.frames && this.frames.length) {
      const advance = dt * this.timeScale * 3 // ~3 solver frames per real second
      const prev = Math.floor(this.frameIndex)
      this.frameIndex = Math.min(this.frames.length - 0.001, this.frameIndex + advance)
      if (Math.floor(this.frameIndex) !== prev) {
        this._applyDebrisFrame(Math.floor(this.frameIndex))
        this._emitDustBurst(Math.floor(this.frameIndex))
        this._updateTimeHud()
      }
      if (this.frameIndex >= this.frames.length - 0.002) {
        if (this.loopPlayback) {
          this.frameIndex = 0
          this._applyDebrisFrame(0)
        } else {
          this.playing = false
          this._updateTimeHud()
        }
      }
    }

    this._updateDust(dt)
    this._updateRain(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    if (this.onStats) {
      this.onStats({
        frame: Math.floor(this.frameIndex),
        total: this.frames ? this.frames.length : 0,
        playing: this.playing,
        debrisMax: this._lastMaxVisible || 0
      })
    }
  }

  _updateTimeHud() {
    const tl = this.simResult?.stats?.timeline
    if (tl && tl.length) {
      const idx = Math.min(tl.length - 1, Math.floor(this.frameIndex))
      const entry = tl[idx]
      this._hud = {
        tLabel: entry?.elapsedLabel,
        runout: entry?.runoutMeters,
        speed: entry?.peakSpeed
      }
    }
  }

  getHud() {
    return this._hud || {}
  }

  _onResize = () => {
    if (!this.renderer) return
    const parent = this.domElement.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
  }

  dispose() {
    this.mounted = false
    this.playing = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this._onResize)
    if (this.mediaRecorder) {
      try { this.mediaRecorder.stop() } catch (e) { /* noop */ }
    }
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement?.remove()
    }
    if (this.scene) {
      this.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const m of mats) m.dispose()
        }
      })
    }
    this.renderer = null
    this.scene = null
  }
}
