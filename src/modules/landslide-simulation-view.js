/**
 * ARAVINDHA - Photorealistic 3D Satellite Terrain & Dynamic Landslide Visualization
 * Powered by MapLibre GL 3D Terrain + Real-Time Particle Kinematics & Debris Flow Physics
 */

import * as maplibregl from 'maplibre-gl';
import { REGIONAL_PRESETS, generateHazardGeoJSON } from './landslide-simulation-engine.js';

export class Landslide3DView {
  constructor(containerId, initialRegion = 'nilgiris') {
    this.containerId = containerId;
    this.currentRegionKey = initialRegion;
    this.map = null;
    this.markers = [];
    this.currentTimeStep = 6; // Default to 14:00 (Current)
    this.flowAnimationId = null;
    this.flowDashOffset = 0;
    
    // Physics Particle Simulation State
    this.particleCanvas = null;
    this.particleCtx = null;
    this.particles = [];
    this.maxParticles = 140;
    this.isSimulatingPhysics = true;
    this.simSpeedMultiplier = 1.0;
    this.isHeatmap3DActive = false;
    this.currentCustomLocation = null;
    this.onLocationSelectedCallback = null;

    this.activeLayers = {
      satellite: true,
      dem: true,
      contours: true,
      hillshade: false,
      riskZones: true,
      flowPath: true,
      runoutZone: true,
      roads: true,
      buildings: true,
      bridges: true,
      waterBodies: true,
      sensors: true
    };
  }

  /**
   * Initialize MapLibre GL 3D Map with Satellite + DEM Terrain
   */
  getCurrentPreset() {
    return this.currentCustomLocation || REGIONAL_PRESETS[this.currentRegionKey] || REGIONAL_PRESETS.nilgiris;
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`Container #${this.containerId} not found`);
      return;
    }

    const preset = REGIONAL_PRESETS[this.currentRegionKey] || REGIONAL_PRESETS.nilgiris;

    // Build MapLibre Map
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: {
        version: 8,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '© ESRI, Maxar, Earthstar Geographics'
          },
          'osm-fallback': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            ],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15
          }
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-tiles',
            paint: {
              'raster-saturation': 0.18,
              'raster-contrast': 0.22,
              'raster-brightness-max': 0.95
            }
          }
        ],
        terrain: {
          source: 'terrain-dem',
          exaggeration: 1.45
        },
        sky: {
          'sky-color': '#0d1829',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#1e293b',
          'horizon-fog-blend': 0.8,
          'fog-color': '#0f172a',
          'fog-ground-blend': 0.7
        }
      },
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      antialias: true,
      maxPitch: 75,
      interactive: true
    });

    this.map.on('load', () => {
      this.setupHazardLayers();
      this.setupContourOverlay();
      this.setupHeatmap3DLayers();
      this.enableHeatmap3DMode();
      this.setupSpatialMarkers();
      this.setupAreaNameLabels();
      this.setupParticleCanvasOverlay();
      this.startContinuousSimulationLoop();
      this.setupCoordHUD();
      this.setupMapInteractionHandlers();

      // Refresh heatmap once terrain DEM tiles finish decoding
      setTimeout(() => {
        if (this.isHeatmap3DActive) {
          this.setupHeatmap3DLayers();
          this.enableHeatmap3DMode();
        }
      }, 450);
    });

    this.map.on('terrain', () => {
      if (this.isHeatmap3DActive) {
        this.setupHeatmap3DLayers();
      }
    });

    this.map.on('error', (e) => {
      console.warn('MapLibre GL Notice:', e);
    });
  }

  /**
   * Setup High-Performance Particle Canvas Overlay for 3D Debris Kinematics
   */
  setupParticleCanvasOverlay() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let canvas = container.querySelector('.sim-particle-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'sim-particle-canvas';
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '5';
      container.appendChild(canvas);
    }

    this.particleCanvas = canvas;
    this.particleCtx = canvas.getContext('2d');
    this.resizeParticleCanvas();

    window.addEventListener('resize', () => this.resizeParticleCanvas());
    this.initParticles();
  }

  resizeParticleCanvas() {
    if (!this.particleCanvas) return;
    const rect = this.particleCanvas.getBoundingClientRect();
    this.particleCanvas.width = rect.width;
    this.particleCanvas.height = rect.height;
  }

  /**
   * Initialize physics debris particles representing soil displacement & cascading clasts
   */
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createDebrisParticle(true));
    }
  }

  createDebrisParticle(randomProgress = false) {
    const preset = this.getCurrentPreset();
    const origin = preset.coords.origin;
    const toe = preset.coords.toe;

    // Progress along slide corridor (0.0 at slip crown, 1.0 at runout toe)
    const t = randomProgress ? Math.random() : 0.0;
    
    // Voellmy-style dynamic velocity calculation
    const slopeAngleRad = (preset.slopeAngle * Math.PI) / 180;
    const gravity = 9.81;
    const baseVelocity = Math.sqrt(2 * gravity * 150 * (1 - Math.tan(0.28) / Math.tan(slopeAngleRad)));

    return {
      t: t,
      speed: (0.003 + Math.random() * 0.005) * (1 + t * 0.8),
      lateralSpread: (Math.random() - 0.5) * 0.0028 * (1 + t * 2.2),
      size: 1.5 + Math.random() * 4.0,
      mass: 10 + Math.random() * 90, // kg
      type: Math.random() > 0.65 ? 'rock' : Math.random() > 0.35 ? 'soil' : 'slurry',
      color: Math.random() > 0.65 ? '#ef4444' : Math.random() > 0.3 ? '#f97316' : '#eab308',
      alpha: 0.6 + Math.random() * 0.4,
      trail: []
    };
  }

  /**
   * Add GeoJSON hazard polygon layers and animated flow path
   */
  setupHazardLayers() {
    if (!this.map) return;
    const preset = this.getCurrentPreset();
    const geo = generateHazardGeoJSON(preset, this.currentTimeStep);

    // 1. Hazard Outer Transition Polygon (Yellow/Amber)
    if (!this.map.getSource('hazard-outer-src')) {
      this.map.addSource('hazard-outer-src', {
        type: 'geojson',
        data: geo.hazardOuter
      });

      this.map.addLayer({
        id: 'hazard-outer-fill',
        type: 'fill',
        source: 'hazard-outer-src',
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.55
        }
      });

      this.map.addLayer({
        id: 'hazard-outer-line',
        type: 'line',
        source: 'hazard-outer-src',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 2,
          'line-opacity': 0.8
        }
      });
    } else {
      this.map.getSource('hazard-outer-src').setData(geo.hazardOuter);
    }

    // 2. Hazard Core Scar Polygon (Intense Red / Crimson Gradient)
    if (!this.map.getSource('hazard-core-src')) {
      this.map.addSource('hazard-core-src', {
        type: 'geojson',
        data: geo.hazardCore
      });

      this.map.addLayer({
        id: 'hazard-core-fill',
        type: 'fill',
        source: 'hazard-core-src',
        paint: {
          'fill-color': '#dc2626',
          'fill-opacity': 0.78
        }
      });

      this.map.addLayer({
        id: 'hazard-core-line',
        type: 'line',
        source: 'hazard-core-src',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2.5,
          'line-opacity': 0.95
        }
      });
    } else {
      this.map.getSource('hazard-core-src').setData(geo.hazardCore);
    }

    // 3. Flow Path Vector Line (Steepest Descent Arrow Route)
    if (!this.map.getSource('flow-path-src')) {
      this.map.addSource('flow-path-src', {
        type: 'geojson',
        data: geo.flowPath
      });

      this.map.addLayer({
        id: 'flow-path-glow',
        type: 'line',
        source: 'flow-path-src',
        paint: {
          'line-color': '#a855f7',
          'line-width': 7,
          'line-opacity': 0.7,
          'line-blur': 4
        }
      });

      this.map.addLayer({
        id: 'flow-path-line',
        type: 'line',
        source: 'flow-path-src',
        paint: {
          'line-color': '#c084fc',
          'line-width': 3.5,
          'line-dasharray': [3, 2]
        }
      });
    } else {
      this.map.getSource('flow-path-src').setData(geo.flowPath);
    }
  }

  /**
   * Topographic Contour Lines
   */
  setupContourOverlay() {
    if (!this.map) return;
    const preset = this.getCurrentPreset();
    const [cLon, cLat] = preset.center;

    const contourFeatures = [
      { elev: 1000, r: 0.024, label: '1000 m' },
      { elev: 1200, r: 0.019, label: '1200 m' },
      { elev: 1400, r: 0.014, label: '1400 m' },
      { elev: 1600, r: 0.009, label: '1600 m' },
      { elev: 1800, r: 0.004, label: '1800 m' }
    ].map(item => {
      const ring = [];
      const numPts = 32;
      for (let i = 0; i <= numPts; i++) {
        const a = (i / numPts) * Math.PI * 2;
        const warp = 1 + 0.25 * Math.sin(a * 3) + 0.15 * Math.cos(a * 5);
        const lon = cLon + Math.cos(a) * item.r * warp * 1.3;
        const lat = cLat + Math.sin(a) * item.r * warp * 0.8;
        ring.push([lon, lat]);
      }
      return {
        type: 'Feature',
        properties: { elevation: item.elev, label: item.label },
        geometry: { type: 'LineString', coordinates: ring }
      };
    });

    const contourGeo = {
      type: 'FeatureCollection',
      features: contourFeatures
    };

    if (!this.map.getSource('contours-src')) {
      this.map.addSource('contours-src', {
        type: 'geojson',
        data: contourGeo
      });

      this.map.addLayer({
        id: 'contours-line',
        type: 'line',
        source: 'contours-src',
        paint: {
          'line-color': 'rgba(148, 163, 184, 0.45)',
          'line-width': 1.2,
          'line-dasharray': [4, 3]
        }
      });
    } else {
      this.map.getSource('contours-src').setData(contourGeo);
    }
  }

  /**
   * Spatial Callout Badges & Markers matching reference image
   */
  setupSpatialMarkers() {
    this.clearMarkers();
    if (!this.map) return;

    const preset = this.getCurrentPreset();
    const f = preset.features;
    const c = preset.coords;

    // 1. Landslide Origin Badge (Red warning header + elevation)
    const elOrigin = document.createElement('div');
    elOrigin.className = 'spatial-badge badge-origin';
    elOrigin.innerHTML = `
      <div class="badge-icon-box bg-red-600">
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white"><path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 6v3h2v-3h-2zm0 4v2h2v-2h-2z"/></svg>
      </div>
      <div class="badge-content">
        <span class="badge-title font-bold">${f.originLabel}</span>
        <span class="badge-sub text-red-300 font-mono text-xs">${f.originElev}</span>
      </div>
    `;
    const mOrigin = new maplibregl.Marker({ element: elOrigin, anchor: 'bottom' })
      .setLngLat(c.origin)
      .addTo(this.map);
    this.markers.push(mOrigin);

    // 2. Predicted Runout Zone (Yellow/Amber warning badge)
    const elRunout = document.createElement('div');
    elRunout.className = 'spatial-badge badge-runout';
    elRunout.innerHTML = `
      <div class="badge-icon-box bg-amber-500">
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      </div>
      <div class="badge-content">
        <span class="badge-title font-bold">Predicted Runout Zone</span>
        <span class="badge-sub text-amber-200 font-mono text-xs">(${f.runoutDistance})</span>
      </div>
    `;
    const mRunout = new maplibregl.Marker({ element: elRunout, anchor: 'top' })
      .setLngLat(c.runoutBadge)
      .addTo(this.map);
    this.markers.push(mRunout);

    // 3. Pine Forest Callout (Green icon badge)
    const elPine = document.createElement('div');
    elPine.className = 'spatial-badge badge-forest';
    elPine.innerHTML = `
      <span class="badge-icon-text">🌲</span>
      <span class="badge-label-text font-semibold">${f.pineForest}</span>
    `;
    const mPine = new maplibregl.Marker({ element: elPine, anchor: 'center' })
      .setLngLat(c.pineForest)
      .addTo(this.map);
    this.markers.push(mPine);

    // 4. Kundala Village Callout
    const elVillage = document.createElement('div');
    elVillage.className = 'spatial-badge badge-village';
    elVillage.innerHTML = `
      <span class="badge-icon-circle bg-red-500"></span>
      <span class="badge-label-text font-medium text-slate-100">${f.villageLabel}</span>
    `;
    const mVillage = new maplibregl.Marker({ element: elVillage, anchor: 'center' })
      .setLngLat(c.village)
      .addTo(this.map);
    this.markers.push(mVillage);

    // 5. Floating Terrain Labels
    const textLabels = [
      { text: f.roadLabel, coords: c.road, className: 'terrain-label label-road' },
      { text: f.riverLabel, coords: c.river, className: 'terrain-label label-river' },
      { text: f.valleyLabel, coords: c.valley, className: 'terrain-label label-valley' },
      { text: '1800 m', coords: [preset.center[0] - 0.007, preset.center[1] + 0.012], className: 'contour-elev-label' },
      { text: '1600 m', coords: [preset.center[0] - 0.009, preset.center[1] + 0.008], className: 'contour-elev-label' },
      { text: '1400 m', coords: [preset.center[0] - 0.012, preset.center[1] + 0.003], className: 'contour-elev-label' },
      { text: '1200 m', coords: [preset.center[0] - 0.015, preset.center[1] - 0.002], className: 'contour-elev-label' },
      { text: '1000 m', coords: [preset.center[0] - 0.018, preset.center[1] - 0.007], className: 'contour-elev-label' }
    ];

    textLabels.forEach(item => {
      const el = document.createElement('div');
      el.className = item.className;
      el.innerText = item.text;
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(item.coords)
        .addTo(this.map);
      this.markers.push(m);
    });
  }

  clearMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers = [];
  }

  /**
   * Build area name label features for a given preset
   * Returns a GeoJSON FeatureCollection covering all named areas in the region
   */
  buildAreaLabelGeoJSON(preset) {
    const c = preset.coords;
    const f = preset.features;
    const [cLon, cLat] = preset.center;

    const features = [
      // ── Primary Region Name (large, displayed prominently at center-top) ──
      {
        type: 'Feature',
        properties: {
          name: preset.name,
          labelType: 'region',
          textSize: 18,
          textColor: '#ffffff',
          haloColor: '#0f172a',
          haloWidth: 3.5,
          textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
          textOffset: [0, -1.8]
        },
        geometry: { type: 'Point', coordinates: [cLon, cLat + 0.022] }
      },
      // ── Sub-region / Subtext label ──
      {
        type: 'Feature',
        properties: {
          name: preset.subtext,
          labelType: 'subregion',
          textSize: 11,
          textColor: '#94a3b8',
          haloColor: '#0f172a',
          haloWidth: 2.5,
          textFont: ['Open Sans Italic', 'Arial Unicode MS Regular'],
          textOffset: [0, -0.5]
        },
        geometry: { type: 'Point', coordinates: [cLon, cLat + 0.016] }
      },
      // ── Origin / Slip Zone ──
      {
        type: 'Feature',
        properties: {
          name: f.originLabel,
          labelType: 'hazard',
          textSize: 12,
          textColor: '#fca5a5',
          haloColor: '#450a0a',
          haloWidth: 2.5,
          textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
          textOffset: [0, 1.2]
        },
        geometry: { type: 'Point', coordinates: c.origin }
      },
      // ── Village / Settlement ──
      {
        type: 'Feature',
        properties: {
          name: f.villageLabel,
          labelType: 'village',
          textSize: 13,
          textColor: '#fde68a',
          haloColor: '#1c1917',
          haloWidth: 2.5,
          textFont: ['Open Sans SemiBold', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.2]
        },
        geometry: { type: 'Point', coordinates: c.village }
      },
      // ── Forest / Vegetation Area ──
      {
        type: 'Feature',
        properties: {
          name: f.pineForest,
          labelType: 'forest',
          textSize: 12,
          textColor: '#86efac',
          haloColor: '#052e16',
          haloWidth: 2.5,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.0]
        },
        geometry: { type: 'Point', coordinates: c.pineForest }
      },
      // ── River ──
      {
        type: 'Feature',
        properties: {
          name: f.riverLabel,
          labelType: 'water',
          textSize: 12,
          textColor: '#7dd3fc',
          haloColor: '#0c4a6e',
          haloWidth: 2.5,
          textFont: ['Open Sans Italic', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.0]
        },
        geometry: { type: 'Point', coordinates: c.river }
      },
      // ── Road ──
      {
        type: 'Feature',
        properties: {
          name: f.roadLabel,
          labelType: 'road',
          textSize: 11,
          textColor: '#fed7aa',
          haloColor: '#431407',
          haloWidth: 2.2,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.0]
        },
        geometry: { type: 'Point', coordinates: c.road }
      },
      // ── Valley ──
      {
        type: 'Feature',
        properties: {
          name: f.valleyLabel,
          labelType: 'terrain',
          textSize: 13,
          textColor: '#c4b5fd',
          haloColor: '#1e1b4b',
          haloWidth: 2.5,
          textFont: ['Open Sans Italic', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.0]
        },
        geometry: { type: 'Point', coordinates: c.valley }
      },
      // ── Runout / Deposit Zone ──
      {
        type: 'Feature',
        properties: {
          name: `Runout Zone (${f.runoutDistance})`,
          labelType: 'runout',
          textSize: 11,
          textColor: '#fde68a',
          haloColor: '#78350f',
          haloWidth: 2.2,
          textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
          textOffset: [0, 1.2]
        },
        geometry: { type: 'Point', coordinates: c.runoutBadge }
      },
      // ── Elevation markers spread across the terrain ──
      {
        type: 'Feature',
        properties: {
          name: '▲ 1800 m',
          labelType: 'elevation',
          textSize: 10,
          textColor: '#e2e8f0',
          haloColor: '#0f172a',
          haloWidth: 1.8,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 0.6]
        },
        geometry: { type: 'Point', coordinates: [cLon - 0.007, cLat + 0.012] }
      },
      {
        type: 'Feature',
        properties: {
          name: '▲ 1600 m',
          labelType: 'elevation',
          textSize: 10,
          textColor: '#cbd5e1',
          haloColor: '#0f172a',
          haloWidth: 1.8,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 0.6]
        },
        geometry: { type: 'Point', coordinates: [cLon + 0.008, cLat + 0.006] }
      },
      {
        type: 'Feature',
        properties: {
          name: '▲ 1400 m',
          labelType: 'elevation',
          textSize: 10,
          textColor: '#94a3b8',
          haloColor: '#0f172a',
          haloWidth: 1.8,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 0.6]
        },
        geometry: { type: 'Point', coordinates: [cLon - 0.012, cLat - 0.005] }
      },
      {
        type: 'Feature',
        properties: {
          name: '▲ 1200 m',
          labelType: 'elevation',
          textSize: 10,
          textColor: '#64748b',
          haloColor: '#0f172a',
          haloWidth: 1.8,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 0.6]
        },
        geometry: { type: 'Point', coordinates: [cLon + 0.014, cLat - 0.010] }
      },
      // ── Slip Crown marker ──
      {
        type: 'Feature',
        properties: {
          name: '⚠ Slip Crown',
          labelType: 'hazard',
          textSize: 11,
          textColor: '#ff8080',
          haloColor: '#3b0000',
          haloWidth: 2.2,
          textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
          textOffset: [0, -1.2]
        },
        geometry: { type: 'Point', coordinates: c.origin }
      },
      // ── Toe / Debris Deposit ──
      {
        type: 'Feature',
        properties: {
          name: 'Debris Toe',
          labelType: 'hazard',
          textSize: 11,
          textColor: '#fbbf24',
          haloColor: '#3b1f00',
          haloWidth: 2.0,
          textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
          textOffset: [0, 1.2]
        },
        geometry: { type: 'Point', coordinates: c.toe }
      }
    ];

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Setup native MapLibre symbol layers for area name labels
   * These labels drape directly onto the 3D terrain surface
   */
  setupAreaNameLabels() {
    if (!this.map) return;
    const preset = this.getCurrentPreset();
    const labelData = this.buildAreaLabelGeoJSON(preset);

    // Remove existing area-labels source/layer if switching regions
    if (this.map.getLayer('area-labels-layer')) {
      this.map.removeLayer('area-labels-layer');
    }
    if (this.map.getSource('area-labels-src')) {
      this.map.removeSource('area-labels-src');
    }

    this.map.addSource('area-labels-src', {
      type: 'geojson',
      data: labelData
    });

    // Single symbol layer — text-field, size, color, halo all driven by feature properties
    this.map.addLayer({
      id: 'area-labels-layer',
      type: 'symbol',
      source: 'area-labels-src',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['get', 'textSize'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'top',
        'text-offset': ['literal', [0, 0.4]],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-max-width': 10,
        'symbol-sort-key': [
          'match',
          ['get', 'labelType'],
          'region', 0,
          'subregion', 1,
          'hazard', 2,
          'village', 3,
          'terrain', 4,
          'forest', 5,
          'water', 6,
          'road', 7,
          'runout', 8,
          'elevation', 9,
          10
        ]
      },
      paint: {
        'text-color': ['get', 'textColor'],
        'text-halo-color': ['get', 'haloColor'],
        'text-halo-width': ['get', 'haloWidth'],
        'text-opacity': 1.0
      }
    });
  }

  /**
   * Continuous Dynamic 3D Simulation Loop:
   * Combines flow dash kinematics, pulsing saturation glows, and interactive cascading debris physics
   */
  startContinuousSimulationLoop() {
    if (this.flowAnimationId) cancelAnimationFrame(this.flowAnimationId);

    const preset = this.getCurrentPreset();

    const renderLoop = () => {
      // 1. Vector Flow Line Pulse & Dashes
      if (this.map && this.map.getLayer('flow-path-line')) {
        this.flowDashOffset = (this.flowDashOffset - 0.18 * this.simSpeedMultiplier) % 5;
        const opacity = 0.55 + 0.3 * Math.sin(Date.now() / 350);
        this.map.setPaintProperty('flow-path-glow', 'line-opacity', opacity);
      }

      // 2. Physics Particle Cascades Rendering
      if (this.isSimulatingPhysics && this.particleCtx && this.map) {
        this.renderPhysicsParticles(preset);
      }

      this.flowAnimationId = requestAnimationFrame(renderLoop);
    };

    this.flowAnimationId = requestAnimationFrame(renderLoop);
  }

  /**
   * Render real-time cascading landslide material particles on the 3D mountain slope
   */
  renderPhysicsParticles(preset) {
    const ctx = this.particleCtx;
    const canvas = this.particleCanvas;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const origin = preset.coords.origin;
    const toe = preset.coords.toe;
    const originPix = this.map.project(origin);
    const toePix = this.map.project(toe);

    const dx = toePix.x - originPix.x;
    const dy = toePix.y - originPix.y;

    const maxScale = (this.currentTimeStep + 1) / 7;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Advance particle progression
      p.t += p.speed * this.simSpeedMultiplier;
      if (p.t > maxScale) {
        // Reset to slide crown
        this.particles[i] = this.createDebrisParticle(false);
        continue;
      }

      // Parabolic descent path with dynamic lateral spread
      const curX = originPix.x + dx * p.t + p.lateralSpread * canvas.width * Math.sin(p.t * Math.PI);
      const curY = originPix.y + dy * p.t + Math.pow(p.t, 1.3) * 12;

      // Update particle motion trail
      p.trail.push({ x: curX, y: curY });
      if (p.trail.length > 5) p.trail.shift();

      // Draw particle trail
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let j = 1; j < p.trail.length; j++) {
          ctx.lineTo(p.trail[j].x, p.trail[j].y);
        }
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.alpha * 0.45;
        ctx.lineWidth = p.size * 0.8;
        ctx.stroke();
      }

      // Draw debris clast / boulder
      ctx.beginPath();
      ctx.arc(curX, curY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  /**
   * Update map to new temporal frame (0 to 6)
   */
  setTimelineStep(stepIndex) {
    this.currentTimeStep = stepIndex;
    const preset = this.getCurrentPreset();
    const geo = generateHazardGeoJSON(preset, stepIndex);

    if (this.map) {
      if (this.map.getSource('hazard-outer-src')) {
        this.map.getSource('hazard-outer-src').setData(geo.hazardOuter);
      }
      if (this.map.getSource('hazard-core-src')) {
        this.map.getSource('hazard-core-src').setData(geo.hazardCore);
      }
      if (this.map.getSource('flow-path-src')) {
        this.map.getSource('flow-path-src').setData(geo.flowPath);
      }
    }
  }

  /**
   * Switch Active Region (Nilgiris, Sikkim, Meghalaya, Wayanad)
   */
  switchRegion(regionKey) {
    if (!REGIONAL_PRESETS[regionKey]) return;
    this.currentCustomLocation = null;
    this.currentRegionKey = regionKey;
    const preset = REGIONAL_PRESETS[regionKey];

    if (this.map) {
      this.map.flyTo({
        center: preset.center,
        zoom: preset.zoom,
        pitch: this.isHeatmap3DActive ? 67 : preset.pitch,
        bearing: this.isHeatmap3DActive ? preset.bearing - 15 : preset.bearing,
        duration: 1600
      });

      setTimeout(() => {
        this.setupHazardLayers();
        this.setupContourOverlay();
        this.setupHeatmap3DLayers();
        this.setupSpatialMarkers();
        this.setupAreaNameLabels();
        this.initParticles();
        this.setTimelineStep(this.currentTimeStep);

        if (this.isHeatmap3DActive) {
          this.enableHeatmap3DMode();
        }
      }, 300);
    }
  }

  /**
   * Generates a 1024x1024 hypsometric heatmap texture matching the reference image exactly:
   * Single centered radial gradient: Crimson → Orange → Yellow → Green → Cyan → Blue → Transparent
   * with dense concentric elliptical contour ring lines draped over the landslide origin.
   * The geographic bounds in setupHeatmap3DLayers() are anchored to preset.coords.origin
   * so every region's hot-spot sits precisely on its slip crown.
   */
  generateHypsometricHeatmapCanvas(preset) {
    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, SIZE, SIZE);

    // ── Canvas centre maps to the landslide origin (slip crown) ──────────────
    const cx = SIZE / 2;   // 512
    const cy = SIZE / 2;   // 512

    // Outer radius of the full heatmap disc (in canvas pixels)
    const R = 460;

    // ── 1. PRIMARY RADIAL GRADIENT  (matches reference image colour ramp) ────
    // Red/Crimson core → Orange → Yellow → Yellow-Green → Green → Teal → Cyan → Blue → transparent
    const mainGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    mainGrad.addColorStop(0.00, 'rgba(200, 20,  20,  0.94)');   // Deep crimson — slip crown
    mainGrad.addColorStop(0.06, 'rgba(220, 38,  38,  0.90)');   // Crimson
    mainGrad.addColorStop(0.12, 'rgba(239, 68,  40,  0.86)');   // Red-orange
    mainGrad.addColorStop(0.20, 'rgba(249, 115, 22,  0.80)');   // Orange
    mainGrad.addColorStop(0.28, 'rgba(251, 146, 60,  0.74)');   // Light orange
    mainGrad.addColorStop(0.36, 'rgba(252, 211, 77,  0.68)');   // Amber-yellow
    mainGrad.addColorStop(0.44, 'rgba(250, 240, 55,  0.62)');   // Bright yellow
    mainGrad.addColorStop(0.52, 'rgba(190, 235, 50,  0.55)');   // Yellow-green
    mainGrad.addColorStop(0.60, 'rgba(74,  222, 128, 0.48)');   // Green
    mainGrad.addColorStop(0.68, 'rgba(20,  184, 166, 0.40)');   // Teal
    mainGrad.addColorStop(0.75, 'rgba(6,   182, 212, 0.32)');   // Cyan
    mainGrad.addColorStop(0.83, 'rgba(56,  189, 248, 0.22)');   // Sky blue
    mainGrad.addColorStop(0.90, 'rgba(59,  130, 246, 0.14)');   // Blue
    mainGrad.addColorStop(0.96, 'rgba(37,  99,  235, 0.06)');   // Deep blue
    mainGrad.addColorStop(1.00, 'rgba(0,   0,   0,   0.00)');   // Transparent edge

    // Paint as a slightly elongated ellipse (terrain perspective)
    ctx.save();
    ctx.scale(1.0, 0.82);  // vertical compression to match oblique 3D view
    ctx.beginPath();
    ctx.arc(cx, cy / 0.82, R, 0, Math.PI * 2);
    ctx.fillStyle = mainGrad;
    ctx.fill();
    ctx.restore();

    // ── 2. CONCENTRIC ELLIPTICAL RING CONTOURS ────────────────────────────────
    // Exact ring spacing and colours matching the reference image
    const rings = [
      { r:  28, lw: 2.2, color: 'rgba(255, 255, 255, 0.80)' },   // innermost white
      { r:  52, lw: 1.8, color: 'rgba(255, 220, 160, 0.75)' },   // warm cream
      { r:  78, lw: 1.8, color: 'rgba(255, 200,  60, 0.70)' },   // amber
      { r: 105, lw: 1.6, color: 'rgba(220, 240,  50, 0.65)' },   // yellow
      { r: 132, lw: 1.6, color: 'rgba(130, 235,  90, 0.60)' },   // yellow-green
      { r: 160, lw: 1.4, color: 'rgba( 60, 220, 160, 0.54)' },   // green
      { r: 188, lw: 1.4, color: 'rgba( 30, 200, 210, 0.48)' },   // teal
      { r: 215, lw: 1.2, color: 'rgba( 50, 190, 240, 0.40)' },   // cyan
      { r: 242, lw: 1.2, color: 'rgba( 80, 170, 255, 0.32)' },   // sky blue
      { r: 268, lw: 1.0, color: 'rgba(100, 150, 255, 0.24)' },   // blue
      { r: 294, lw: 1.0, color: 'rgba(110, 130, 255, 0.18)' },   // mid blue
      { r: 320, lw: 0.8, color: 'rgba(120, 120, 250, 0.12)' },   // faint indigo
      { r: 346, lw: 0.8, color: 'rgba(130, 110, 240, 0.08)' },   // outer faint
      { r: 372, lw: 0.6, color: 'rgba(140, 100, 230, 0.05)' },   // barely visible
    ];

    ctx.save();
    ctx.scale(1.0, 0.82);
    rings.forEach(ring => {
      ctx.beginPath();
      ctx.ellipse(cx, cy / 0.82, ring.r, ring.r, 0, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.lw;
      ctx.stroke();
    });
    ctx.restore();

    // ── 3. SUBTLE INNER GLOW HOTSPOT at slip crown ────────────────────────────
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    coreGlow.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)');
    coreGlow.addColorStop(0.4, 'rgba(255, 100,  50, 0.18)');
    coreGlow.addColorStop(1.0, 'rgba(0,   0,    0,  0.00)');
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();

    return canvas;
  }

  generateHypsometricHeatmapDataURL(preset) {
    return this.generateHypsometricHeatmapCanvas(preset).toDataURL();
  }

  /**
   * Setup 3D Topographic Risk Heatmap Layers
   * Bounds are anchored to preset.coords.origin so the red hot-spot sits
   * exactly on the landslide slip crown for EVERY region.
   */
  setupHeatmap3DLayers() {
    if (!this.map) return;
    const preset = this.getCurrentPreset();

    // ── Anchor bounding box to the ORIGIN (slip crown), not the region centre ──
    // This ensures the crimson hot-spot in the heatmap always aligns with the slip zone.
    const [oLon, oLat] = preset.coords.origin;

    // Span covers the full debris corridor + runout buffer
    const spanLon = 0.090;
    const spanLat = 0.075;
    const bounds = [
      [oLon - spanLon / 2, oLat + spanLat / 2], // Top-Left
      [oLon + spanLon / 2, oLat + spanLat / 2], // Top-Right
      [oLon + spanLon / 2, oLat - spanLat / 2], // Bottom-Right
      [oLon - spanLon / 2, oLat - spanLat / 2]  // Bottom-Left
    ];

    const canvas = this.generateHypsometricHeatmapCanvas(preset);

    if (this.map.getSource('heatmap-3d-raster-src')) {
      const src = this.map.getSource('heatmap-3d-raster-src');
      src.updateImage({
        image: canvas,
        coordinates: bounds
      });
    } else {
      this.map.addSource('heatmap-3d-raster-src', {
        type: 'image',
        url: canvas.toDataURL(),
        coordinates: bounds
      });

      const src = this.map.getSource('heatmap-3d-raster-src');
      if (src) {
        src.updateImage({
          image: canvas,
          coordinates: bounds
        });
      }

      this.map.addLayer({
        id: 'heatmap-3d-raster-layer',
        type: 'raster',
        source: 'heatmap-3d-raster-src',
        layout: { visibility: 'visible' },
        paint: {
          'raster-opacity': 0.88,
          'raster-fade-duration': 0
        }
      });
    }
    this.map.triggerRepaint();
  }

  enableHeatmap3DMode() {
    if (!this.map) return;
    const preset = this.getCurrentPreset();
    this.isHeatmap3DActive = true;

    // Ensure layers are instantiated
    if (!this.map.getSource('heatmap-3d-raster-src')) {
      this.setupHeatmap3DLayers();
    } else {
      const src = this.map.getSource('heatmap-3d-raster-src');
      if (src) {
        const canvas = this.generateHypsometricHeatmapCanvas(preset);
        src.updateImage({
          image: canvas,
          coordinates: src.coordinates
        });
      }
    }

    // 1. Extreme 3D Exaggeration + Oblique Camera Angle
    this.map.setTerrain({ source: 'terrain-dem', exaggeration: 2.15 });
    this.map.easeTo({
      pitch: 65,
      bearing: preset.bearing - 15,
      zoom: preset.zoom - 0.15,
      duration: 1200
    });

    // 2. Keep Satellite imagery 100% visible and vivid so city, streets, buildings, and terrain remain clear
    if (this.map.getLayer('satellite-layer')) {
      this.map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      this.map.setPaintProperty('satellite-layer', 'raster-opacity', 1.0);
      this.map.setPaintProperty('satellite-layer', 'raster-saturation', 0.2);
      this.map.setPaintProperty('satellite-layer', 'raster-contrast', 0.22);
      this.map.setPaintProperty('satellite-layer', 'raster-brightness-max', 0.98);
    }

    // 3. Reveal Transparent 3D Heatmap Draped Overlay
    if (this.map.getLayer('heatmap-3d-raster-layer')) {
      this.map.setLayoutProperty('heatmap-3d-raster-layer', 'visibility', 'visible');
    }

    // 3. Reveal Hypsometric Legend and 3D Coordinate Collar
    const legend = document.getElementById('sim-heatmap-legend');
    if (legend) legend.classList.remove('hidden');

    const collar = document.getElementById('sim-coord-collar');
    if (collar) {
      collar.classList.remove('hidden');
      this.updateCollarCoordinates();
    }
  }

  disableHeatmap3DMode() {
    if (!this.map) return;
    this.isHeatmap3DActive = false;

    // 1. Hide 3D Heatmap Draped Raster
    if (this.map.getLayer('heatmap-3d-raster-layer')) {
      this.map.setLayoutProperty('heatmap-3d-raster-layer', 'visibility', 'none');
    }

    // 2. Hide Legend & Collar
    const legend = document.getElementById('sim-heatmap-legend');
    if (legend) legend.classList.add('hidden');

    const collar = document.getElementById('sim-coord-collar');
    if (collar) collar.classList.add('hidden');
  }

  updateCollarCoordinates() {
    const preset = this.getCurrentPreset();
    const [cLon, cLat] = preset.center;

    const latEl = document.getElementById('collar-axis-lat');
    const lonEl = document.getElementById('collar-axis-lon');

    const formatCoord = (val, dir) => {
      const deg = Math.floor(val);
      const min = Math.round((val - deg) * 60).toString().padStart(2, '0');
      return `${deg}°${min}' ${dir}`;
    };

    if (latEl) {
      const latMin = cLat - 0.04;
      const latMax = cLat + 0.04;
      latEl.innerHTML = `
        <span class="collar-tick">${formatCoord(latMax, 'N')}</span>
        <span class="collar-tick">${formatCoord(cLat + 0.015, 'N')}</span>
        <span class="collar-tick">${formatCoord(cLat - 0.015, 'N')}</span>
        <span class="collar-tick">${formatCoord(latMin, 'N')}</span>
      `;
    }

    if (lonEl) {
      const lonMin = cLon - 0.05;
      const lonMax = cLon + 0.05;
      lonEl.innerHTML = `
        <span class="collar-tick">${formatCoord(lonMin, 'E')}</span>
        <span class="collar-tick">${formatCoord(cLon - 0.025, 'E')}</span>
        <span class="collar-tick">${formatCoord(cLon, 'E')}</span>
        <span class="collar-tick">${formatCoord(cLon + 0.025, 'E')}</span>
        <span class="collar-tick">${formatCoord(lonMax, 'E')}</span>
      `;
    }
  }

  /**
   * Switch View Mode (2D / 3D / Terrain / 3D Risk Heatmap)
   */
  setViewMode(mode) {
    if (!this.map) return;
    const preset = this.getCurrentPreset();

    if (mode === 'heatmap3d') {
      this.enableHeatmap3DMode();
      return;
    }

    // Disable heatmap 3D specific layers when switching back
    this.disableHeatmap3DMode();

    if (mode === '2d') {
      this.map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      this.map.setTerrain(null);
    } else if (mode === '3d') {
      this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1.45 });
      this.map.easeTo({ pitch: preset.pitch, bearing: preset.bearing, duration: 1000 });
    } else if (mode === 'terrain') {
      this.map.setTerrain({ source: 'terrain-dem', exaggeration: 2.1 });
      this.map.easeTo({ pitch: 68, bearing: preset.bearing + 15, duration: 1000 });
    }
  }


  setupMapInteractionHandlers() {
    if (!this.map) return;
    const canvas = this.map.getCanvas();
    if (canvas) canvas.style.cursor = 'crosshair';

    let lastClickTime = 0;
    const handleCoordClick = (lng, lat) => {
      const now = Date.now();
      if (now - lastClickTime < 250) return;
      lastClickTime = now;
      this.focusHeatmapAtCoordinate([lng, lat]);
    };

    this.map.on('click', (e) => {
      handleCoordClick(e.lngLat.lng, e.lngLat.lat);
    });

    if (canvas) {
      canvas.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const lngLat = this.map.unproject([x, y]);
        if (lngLat) {
          handleCoordClick(lngLat.lng, lngLat.lat);
        }
      });
    }
  }

  renderClickPing(lng, lat) {
    if (!this.map) return;
    const pingEl = document.createElement('div');
    pingEl.className = 'sim-click-ping-ring';
    const marker = new maplibregl.Marker({ element: pingEl, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(this.map);
    setTimeout(() => {
      marker.remove();
    }, 1400);
  }

  focusHeatmapAtCoordinate(lngLat, customOptions = {}) {
    if (!this.map || !Array.isArray(lngLat)) return;
    const [cLon, cLat] = lngLat;

    let terrainElev = 1650;
    if (this.map.queryTerrainElevation) {
      const q = this.map.queryTerrainElevation([cLon, cLat]);
      if (q != null && !isNaN(q)) terrainElev = Math.round(q);
    }
    if (customOptions.elevation) terrainElev = customOptions.elevation;

    const basePreset = REGIONAL_PRESETS[this.currentRegionKey] || REGIONAL_PRESETS.nilgiris;
    const slopeDeg = Math.min(52, Math.max(26, Math.round(28 + (terrainElev % 100) * 0.22)));
    const runoutDistanceM = Math.round(1800 + (terrainElev % 500) * 2.8);
    const toeOffsetLon = 0.012 * Math.cos((slopeDeg * Math.PI) / 180);
    const toeOffsetLat = -0.015 * Math.sin((slopeDeg * Math.PI) / 180);

    const customPreset = {
      ...basePreset,
      id: 'custom_point',
      name: customOptions.name || `Point [${cLat.toFixed(3)}°N, ${cLon.toFixed(3)}°E]`,
      subtext: `Dynamic 3D Topographic Analysis | Elev: ${terrainElev} m | Slope: ${slopeDeg}°`,
      center: [cLon, cLat],
      elevation: terrainElev,
      slopeAngle: slopeDeg,
      features: {
        originLabel: `Zone Crown (${terrainElev} m)`,
        originElev: `${terrainElev} m`,
        runoutDistance: `${(runoutDistanceM / 1000).toFixed(1)} km`,
        pineForest: `Canopy Cover Sector`,
        riverLabel: `Catchment Stream`,
        roadLabel: `Access Corridor`,
        villageLabel: `Settlement Pocket`,
        valleyLabel: `Runout Basin`
      },
      coords: {
        origin: [cLon, cLat],
        toe: [cLon + toeOffsetLon, cLat + toeOffsetLat],
        runoutBadge: [cLon + toeOffsetLon * 0.55, cLat + toeOffsetLat * 0.55],
        village: [cLon + toeOffsetLon * 1.15, cLat + toeOffsetLat * 1.15],
        river: [cLon + toeOffsetLon * 0.9, cLat + toeOffsetLat * 0.7],
        road: [cLon - 0.008, cLat + 0.004],
        pineForest: [cLon - 0.010, cLat + 0.008],
        valley: [cLon + toeOffsetLon * 1.25, cLat + toeOffsetLat * 1.25]
      }
    };

    this.currentCustomLocation = customPreset;

    // 1. Update 3D Topographic Heatmap Bounds centered on clicked location
    const spanLon = 0.090;
    const spanLat = 0.075;
    const bounds = [
      [cLon - spanLon / 2, cLat + spanLat / 2], // Top-Left
      [cLon + spanLon / 2, cLat + spanLat / 2], // Top-Right
      [cLon + spanLon / 2, cLat - spanLat / 2], // Bottom-Right
      [cLon - spanLon / 2, cLat - spanLat / 2]  // Bottom-Left
    ];

    const canvas = this.generateHypsometricHeatmapCanvas(customPreset);

    if (this.map.getSource('heatmap-3d-raster-src')) {
      const src = this.map.getSource('heatmap-3d-raster-src');
      src.updateImage({
        image: canvas,
        coordinates: bounds
      });
    } else {
      this.setupHeatmap3DLayers();
    }
    this.map.triggerRepaint();

    // 2. Enable 3D Heatmap mode and relief
    this.enableHeatmap3DMode();

    // 3. Update dynamic contour lines centered on clicked point
    this.setupContourOverlay();

    // 4. Update dynamic hazard zones & flow path
    this.setupHazardLayers();

    // 5. Update markers & labels
    this.setupSpatialMarkers();
    this.setupAreaNameLabels();

    // 6. Re-center physics particles
    this.initParticles();

    // 7. Smoothly ease camera to focus on clicked location
    this.map.easeTo({
      center: [cLon, cLat],
      pitch: 65,
      bearing: this.map.getBearing() || -22,
      zoom: Math.max(13.6, this.map.getZoom()),
      duration: 1100
    });

    // 8. Render click ping ripple
    this.renderClickPing(cLon, cLat);

    // 8b. Update collar coordinates to reflect clicked point
    this.updateCollarCoordinates();

    // 9. Notify Dashboard UI callback
    if (typeof this.onLocationSelectedCallback === 'function') {
      this.onLocationSelectedCallback({
        lng: cLon,
        lat: cLat,
        elevation: terrainElev,
        slope: slopeDeg,
        preset: customPreset
      });
    }
  }

  /**
   * Live Lat, Lon, Elev Coordinate HUD Tracker
   */
  setupCoordHUD() {
    const hudEl = document.getElementById('map-coord-hud');
    if (!hudEl || !this.map) return;

    this.map.on('mousemove', (e) => {
      const lat = e.lngLat.lat.toFixed(4);
      const lon = e.lngLat.lng.toFixed(4);
      const elev = Math.round(1256 + 400 * Math.sin(e.lngLat.lat * 100));
      hudEl.innerHTML = `Lat: <span class="coord-val">${lat}° N</span> &nbsp; Lon: <span class="coord-val">${lon}° E</span> &nbsp; Elev: <span class="coord-val">${elev.toLocaleString()} m</span> &nbsp; <span style="color:#38bdf8; font-size:10px; font-weight:700;">⚡ Click anywhere to generate 3D Heatmap</span>`;
    });
  }

  /**
   * Toggle Layer Visibility
   */
  toggleLayer(layerKey, isVisible) {
    this.activeLayers[layerKey] = isVisible;
    const visibility = isVisible ? 'visible' : 'none';

    if (layerKey === 'satellite' && this.map.getLayer('satellite-layer')) {
      this.map.setLayoutProperty('satellite-layer', 'visibility', visibility);
    } else if (layerKey === 'contours' && this.map.getLayer('contours-line')) {
      this.map.setLayoutProperty('contours-line', 'visibility', visibility);
    } else if (layerKey === 'riskZones') {
      if (this.map.getLayer('hazard-outer-fill')) this.map.setLayoutProperty('hazard-outer-fill', 'visibility', visibility);
      if (this.map.getLayer('hazard-core-fill')) this.map.setLayoutProperty('hazard-core-fill', 'visibility', visibility);
    } else if (layerKey === 'flowPath') {
      if (this.map.getLayer('flow-path-line')) this.map.setLayoutProperty('flow-path-line', 'visibility', visibility);
      if (this.map.getLayer('flow-path-glow')) this.map.setLayoutProperty('flow-path-glow', 'visibility', visibility);
      this.isSimulatingPhysics = isVisible;
    } else if (layerKey === 'dem') {
      this.map.setTerrain(isVisible ? { source: 'terrain-dem', exaggeration: 1.45 } : null);
    }
  }

  destroy() {
    if (this.flowAnimationId) cancelAnimationFrame(this.flowAnimationId);
    this.clearMarkers();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
