/**
 * ARAVINDHA - Landslide Simulation Dashboard UI Controller
 * Faithfully matches the reference screenshot layout and interactive controls.
 */

import Chart from 'chart.js/auto';
import * as maplibregl from 'maplibre-gl';
import { Landslide3DView } from './landslide-simulation-view.js';
import {
  REGIONAL_PRESETS,
  getTemporalProgression,
  getScenarioMatrix,
  getInfrastructureImpacts,
  calculateEnsembleRisk
} from './landslide-simulation-engine.js';
import { predictLandslideProbability, quickHeuristic } from './ml-client.js';
import { fetchRoadsForBbox } from './road-network.js';

export class LandslideDashboardUI {
  constructor(targetContainerId) {
    this.targetContainerId = targetContainerId;
    this.currentRegionKey = 'nilgiris';
    this.currentStep = 6; // 14:00 (Current)
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.playTimer = null;
    this.simView = null;
    this.progressionChart = null;
    this.currentScenarioTab = 'rainfall';
  }

  mount() {
    const container = document.getElementById(this.targetContainerId);
    if (!container) return;

    container.innerHTML = this.renderTemplate();
    this.attachEventListeners();
    this.startLiveClock();
    this.initMiniThumbnails();
    this.initRiskProgressionChart();

    // Instantiate 3D map
    this.simView = new Landslide3DView('simulation-map-container', this.currentRegionKey);
    this.simView.init();

    // Connect dynamic click-to-heatmap listener
    this.simView.onLocationSelectedCallback = (info) => {
      this.handleCustomLocationSelected(info);
    };

    this.updateDashboardMetrics(this.currentStep);
  }

  renderTemplate() {
    const preset = REGIONAL_PRESETS[this.currentRegionKey] || REGIONAL_PRESETS.nilgiris;

    return `
    <div class="sim-cockpit-root">
      
      <!-- TOPBAR -->
      <header class="sim-topbar">
        <div class="sim-brand-block">
          <div class="sim-brand-logo">
            <svg viewBox="0 0 24 24" class="sim-logo-svg"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2L7 10l-6 8h22L14 6z"/></svg>
          </div>
          <div>
            <div class="sim-title-row">
              <h1 class="sim-main-title">Landslide Risk Monitoring & Simulation</h1>
              <select id="sim-region-selector" class="sim-region-dropdown">
                <option value="nilgiris" selected>Nilgiris, Tamil Nadu</option>
                <option value="sikkim">Gangtok & Teesta Valley, Sikkim</option>
                <option value="meghalaya">Shillong & Sohra, Meghalaya</option>
                <option value="wayanad">Wayanad (Chooralmala), Kerala</option>
                <option value="nepal_china">Nepal-China Border (Kerung / Rasuwagadhi)</option>
              </select>
            </div>
            <div class="sim-sub-text" id="sim-region-subtext">
              ${preset.name} | Real-time Data | Predictive Analytics | 3D Visualization
            </div>
          </div>
        </div>

        <div class="sim-top-right">
          <div class="sim-time-badge">
            <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5 inline fill-current"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
            <span id="sim-live-clock">11 Sep 2026 &nbsp; 14:30 IST</span>
          </div>

          <div class="sim-live-indicator">
            <span class="pulse-dot"></span>
            <span>Live Data</span>
          </div>


        </div>
      </header>

      <!-- MAIN WORKSPACE (LEFT LAYERS, CENTER 3D VIEW + TIMELINE, RIGHT ANALYTICS) -->
      <div class="sim-main-grid">
        
        <!-- LEFT PANEL: LAYERS -->
        <aside class="sim-layers-sidebar" id="sim-layers-panel">
          <div class="layers-header">
            <div class="layers-header-title">
              <svg viewBox="0 0 24 24" class="w-4 h-4 mr-2 inline"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9.07l-9-7-9 7 1.63 1.2L12 16z"/></svg>
              <span>Layers</span>
            </div>
            <button class="layers-collapse-btn" id="layers-collapse-toggle" title="Collapse Panel">✕</button>
          </div>

          <div class="layers-search-box">
            <svg viewBox="0 0 24 24" class="layers-search-icon"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input type="text" id="layers-filter-input" placeholder="Search layers..." />
          </div>

          <div class="layers-scroll-content">
            
            <!-- GROUP: BASE LAYERS -->
            <div class="layer-group expanded">
              <div class="layer-group-header">
                <span class="group-caret">▾</span>
                <span>Base Layers</span>
              </div>
              <div class="layer-group-body">
                <label class="layer-item">
                  <input type="checkbox" id="layer-chk-satellite" checked />
                  <span class="layer-icon text-sky-400">🛰</span>
                  <span class="layer-name">Satellite Imagery (RGB)</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" id="layer-chk-dem" checked />
                  <span class="layer-icon text-emerald-400">⛰</span>
                  <span class="layer-name">Terrain Elevation (DEM)</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" id="layer-chk-contours" checked />
                  <span class="layer-icon text-slate-300">〰</span>
                  <span class="layer-name">Topographic Contours</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" id="layer-chk-hillshade" />
                  <span class="layer-icon text-slate-400">🌓</span>
                  <span class="layer-name">Hillshade</span>
                </label>
              </div>
            </div>

            <!-- GROUP: RISK & SIMULATION -->
            <div class="layer-group expanded">
              <div class="layer-group-header">
                <span class="group-caret">▾</span>
                <span>Risk & Simulation</span>
              </div>
              <div class="layer-group-body">
                <label class="layer-item has-sub">
                  <input type="checkbox" id="layer-chk-risk-zones" checked />
                  <span class="layer-icon text-red-500">🔥</span>
                  <span class="layer-name">Landslide Risk Zones</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" id="layer-chk-flow-path" checked />
                  <span class="layer-icon text-blue-400">⤹</span>
                  <span class="layer-name">Flow Path (Predicted)</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" id="layer-chk-runout" checked />
                  <span class="layer-icon text-amber-400">⨀</span>
                  <span class="layer-name">Runout Zone</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" id="layer-chk-sim-anim" checked />
                  <span class="layer-icon text-purple-400">▶</span>
                  <span class="layer-name">Simulation Animation</span>
                  <span class="layer-sub-caret">›</span>
                </label>
              </div>
            </div>

            <!-- GROUP: INFRASTRUCTURE -->
            <div class="layer-group expanded">
              <div class="layer-group-header">
                <span class="group-caret">▾</span>
                <span>Infrastructure</span>
              </div>
              <div class="layer-group-body">
                <label class="layer-item has-sub">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-amber-300">🛣</span>
                  <span class="layer-name">Roads</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-blue-300">🏢</span>
                  <span class="layer-name">Buildings</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-orange-300">🌉</span>
                  <span class="layer-name">Bridges</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" />
                  <span class="layer-icon text-yellow-400">⚡</span>
                  <span class="layer-name">Power Lines</span>
                  <span class="layer-sub-caret">›</span>
                </label>
                <label class="layer-item has-sub">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-cyan-400">💧</span>
                  <span class="layer-name">Water Bodies</span>
                  <span class="layer-sub-caret">›</span>
                </label>
              </div>
            </div>

            <!-- GROUP: MONITORING STATIONS -->
            <div class="layer-group expanded">
              <div class="layer-group-header">
                <span class="group-caret">▾</span>
                <span>Monitoring Stations</span>
              </div>
              <div class="layer-group-body">
                <label class="layer-item">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-emerald-400">🌱</span>
                  <span class="layer-name">Soil Moisture Sensors</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-cyan-400">📈</span>
                  <span class="layer-name">Seismic Stations</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-blue-400">🌧</span>
                  <span class="layer-name">Rainfall Stations</span>
                </label>
              </div>
            </div>

            <!-- GROUP: ADMINISTRATIVE -->
            <div class="layer-group expanded">
              <div class="layer-group-header">
                <span class="group-caret">▾</span>
                <span>Administrative</span>
              </div>
              <div class="layer-group-body">
                <label class="layer-item">
                  <input type="checkbox" checked />
                  <span class="layer-icon text-slate-400">◻</span>
                  <span class="layer-name">District Boundary</span>
                </label>
                <label class="layer-item">
                  <input type="checkbox" />
                  <span class="layer-icon text-slate-400">◻</span>
                  <span class="layer-name">Village Boundary</span>
                </label>
              </div>
            </div>

          </div>

          <!-- MAP TOOLS FOOTER -->
          <div class="layers-map-tools">
            <div class="map-tools-title">Map Tools</div>
            <div class="map-tools-grid">
              <button class="tool-btn" id="tool-pan" title="Pan"><span class="tool-icon">✥</span><span>Pan</span></button>
              <button class="tool-btn" id="tool-zoom-in" title="Zoom In"><span class="tool-icon">🔍+</span><span>Zoom In</span></button>
              <button class="tool-btn" id="tool-zoom-out" title="Zoom Out"><span class="tool-icon">🔍-</span><span>Zoom Out</span></button>
              <button class="tool-btn" id="tool-draw" title="Draw Boundary"><span class="tool-icon">✏</span><span>Draw</span></button>
              <button class="tool-btn" id="tool-identify" title="Feature Identify"><span class="tool-icon">ℹ</span><span>Identify</span></button>
            </div>
          </div>
        </aside>

        <!-- CENTER: 3D VIEWPORT & BOTTOM TIMELINE -->
        <main class="sim-center-column">
          
          <div class="sim-viewport-wrapper">
            <!-- 2D / 3D RISK HEATMAP PILL SWITCHER -->
            <div class="sim-viewmode-pills">
              <button class="viewmode-btn" data-mode="2d">2D</button>
              <button class="viewmode-btn active viewmode-heatmap-btn" data-mode="heatmap3d" title="Landslide Susceptibility Heatmap">
                <span class="heatmap-btn-icon">🔥</span> Heatmap
              </button>
            </div>

            <!-- COMPASS NORTH WIDGET -->
            <div class="sim-compass-widget" title="North orientation">
              <div class="compass-circle">
                <div class="compass-needle"></div>
                <span class="compass-label">N</span>
              </div>
            </div>

            <!-- SCALE BAR -->
            <div class="sim-scalebar">
              <div class="scale-ticks">
                <span>0</span>
                <span>250</span>
                <span>500</span>
                <span>1,000 m</span>
              </div>
              <div class="scale-line"></div>
            </div>

            <!-- COORDINATE HUD -->
            <div class="sim-coord-hud" id="map-coord-hud">
              Lat: <span class="coord-val">10.2147° N</span> &nbsp; Lon: <span class="coord-val">76.7843° E</span> &nbsp; Elev: <span class="coord-val">1,256 m</span>
            </div>

            <!-- 3D MAP CANVAS CONTAINER -->
            <div id="simulation-map-container" class="sim-map-canvas"></div>
          </div>

        </main>

        <!-- RIGHT PANEL: ANALYTICS & IMPACT ASSESSOR -->
        <aside class="sim-analytics-sidebar">
          
          <!-- 1. LANDSLIDE RISK OVERVIEW -->
          <div class="analytics-card card-risk-overview">
            <h3 class="card-heading">Landslide Risk Overview</h3>
            <div class="risk-overview-content">
              <div class="risk-radial-box">
                <svg viewBox="0 0 120 120" class="risk-donut-svg">
                  <circle cx="60" cy="60" r="50" class="donut-bg" />
                  <circle cx="60" cy="60" r="50" class="donut-fg" id="risk-donut-fg" style="stroke-dashoffset: 69;" />
                </svg>
                <div class="donut-center-text">
                  <span class="donut-val" id="risk-pct-val">78%</span>
                  <span class="donut-level text-red-500 font-bold" id="risk-level-tag">High Risk</span>
                </div>
                <span id="risk-donut-ml-source" class="donut-ml-source" title="">🤖 ML: loading…</span>
              </div>

              <div class="risk-scale-legend">
                <div class="legend-row">
                  <span class="legend-dot bg-yellow-400"></span>
                  <span class="legend-name">Low</span>
                  <span class="legend-range">0 – 20%</span>
                </div>
                <div class="legend-row">
                  <span class="legend-dot bg-amber-500"></span>
                  <span class="legend-name">Moderate</span>
                  <span class="legend-range">20 – 50%</span>
                </div>
                <div class="legend-row">
                  <span class="legend-dot bg-orange-600"></span>
                  <span class="legend-name">High</span>
                  <span class="legend-range">50 – 75%</span>
                </div>
                <div class="legend-row">
                  <span class="legend-dot bg-red-700"></span>
                  <span class="legend-name">Extreme</span>
                  <span class="legend-range">75 – 100%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. CURRENT CONDITIONS GRID -->
          <div class="analytics-card card-conditions">
            <h3 class="card-heading">Current Conditions</h3>
            <div class="conditions-grid">
              
              <div class="cond-card">
                <div class="cond-icon text-sky-400">💧</div>
                <div class="cond-info">
                  <div class="cond-lbl">Rainfall (24h)</div>
                  <div class="cond-val" id="cond-rain">142 mm</div>
                </div>
              </div>

              <div class="cond-card">
                <div class="cond-icon text-orange-400">📐</div>
                <div class="cond-info">
                  <div class="cond-lbl">Slope Angle</div>
                  <div class="cond-val" id="cond-slope">32°</div>
                </div>
              </div>

              <div class="cond-card">
                <div class="cond-icon text-emerald-400">🌱</div>
                <div class="cond-info">
                  <div class="cond-lbl">Soil Moisture</div>
                  <div class="cond-val" id="cond-moisture">87%</div>
                </div>
              </div>

              <div class="cond-card">
                <div class="cond-icon text-amber-400">🧱</div>
                <div class="cond-info">
                  <div class="cond-lbl">Soil Type</div>
                  <div class="cond-val text-sm font-semibold" id="cond-soil">Clay Loam</div>
                </div>
              </div>

              <div class="cond-card">
                <div class="cond-icon text-cyan-400">〰</div>
                <div class="cond-info">
                  <div class="cond-lbl">Seismic Activity</div>
                  <div class="cond-val" id="cond-seismic">Moderate</div>
                </div>
              </div>

              <div class="cond-card">
                <div class="cond-icon text-purple-400">⛰</div>
                <div class="cond-info">
                  <div class="cond-lbl">Bedrock Depth</div>
                  <div class="cond-val" id="cond-bedrock">12 m</div>
                </div>
              </div>

            </div>
          </div>

          <!-- 3. RISK PROGRESSION (LAST 6 HOURS) -->
          <div class="analytics-card card-progression">
            <h3 class="card-heading">Risk Progression (Last 6 Hours)</h3>
            <div class="progression-chart-box">
              <canvas id="risk-progression-canvas" height="135"></canvas>
            </div>
          </div>

          <!-- 4. SCENARIO COMPARISON -->
          <div class="analytics-card card-scenarios">
            <h3 class="card-heading">Scenario Comparison</h3>
            <div class="scenario-tabs">
              <button class="scen-tab active" data-tab="rainfall">Rainfall Variation</button>
              <button class="scen-tab" data-tab="seismic">Seismic Variation</button>
              <button class="scen-tab" data-tab="combined">Combined</button>
            </div>
            <div class="scenario-table-box">
              <table class="scenario-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th id="scen-col-param">Rainfall (24h)</th>
                    <th>Probability</th>
                    <th>Runout Distance</th>
                    <th>Impacted Roads</th>
                  </tr>
                </thead>
                <tbody id="scenario-tbody">
                  <!-- Dynamic rows -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. AFFECTED INFRASTRUCTURE -->
          <div class="analytics-card card-infrastructure">
            <h3 class="card-heading">Affected Infrastructure</h3>
            <!-- REAL-TIME ROAD CONNECTIVITY (OpenStreetMap) -->
            <div class="roadnet-panel" id="roadnet-panel">
              <div class="roadnet-head">
                <span class="roadnet-title">🛣 Road Connectivity <span class="roadnet-src" id="roadnet-src">OpenStreetMap</span></span>
                <span class="roadnet-status" id="roadnet-status">loading…</span>
              </div>
              <div class="roadnet-kpis">
                <div class="roadnet-kpi"><strong id="roadnet-total">—</strong><span>roads</span></div>
                <div class="roadnet-kpi"><strong id="roadnet-km">—</strong><span>km network</span></div>
                <div class="roadnet-kpi warn"><strong id="roadnet-atrisk">—</strong><span>at risk</span></div>
              </div>
              <ul class="roadnet-list" id="roadnet-list">
                <li class="roadnet-empty">Select a location to load its real road network…</li>
              </ul>
            </div>
            <div class="infra-grid">
              
              <div class="infra-item">
                <span class="infra-icon text-amber-300">🛣</span>
                <div class="infra-details">
                  <span class="infra-name">Roads</span>
                  <div class="infra-nums"><strong id="infra-roads-num">3</strong> <small id="infra-roads-km">(2.3 km)</small></div>
                </div>
              </div>

              <div class="infra-item">
                <span class="infra-icon text-blue-300">🏢</span>
                <div class="infra-details">
                  <span class="infra-name">Buildings</span>
                  <div class="infra-nums"><strong id="infra-bld-num">17</strong> <small class="text-red-400 font-medium">(high damage)</small></div>
                </div>
              </div>

              <div class="infra-item">
                <span class="infra-icon text-orange-300">🌉</span>
                <div class="infra-details">
                  <span class="infra-name">Bridges</span>
                  <div class="infra-nums"><strong id="infra-bridges-num">1</strong> <small class="text-amber-400">(at risk)</small></div>
                </div>
              </div>

              <div class="infra-item">
                <span class="infra-icon text-yellow-300">⚡</span>
                <div class="infra-details">
                  <span class="infra-name">Power Lines</span>
                  <div class="infra-nums"><strong id="infra-power-num">4</strong> <small class="text-amber-400">(at risk)</small></div>
                </div>
              </div>

              <div class="infra-item">
                <span class="infra-icon text-sky-300">📡</span>
                <div class="infra-details">
                  <span class="infra-name">Communication Towers</span>
                  <div class="infra-nums"><strong id="infra-towers-num">2</strong> <small class="text-amber-400">(at risk)</small></div>
                </div>
              </div>

              <div class="infra-item">
                <span class="infra-icon text-cyan-300">🚰</span>
                <div class="infra-details">
                  <span class="infra-name">Water Pipelines</span>
                  <div class="infra-nums"><strong id="infra-water-num">2</strong> <small class="text-amber-400">(at risk)</small></div>
                </div>
              </div>

            </div>
          </div>

        </aside>

      </div>

      <!-- BOTTOM ALERT FOOTER BAR -->
      <footer class="sim-bottom-bar">
        <div class="status-online-tag">
          <span class="pulse-dot"></span>
          <strong class="text-slate-100">System Online</strong>
          <span class="text-slate-400 text-xs ml-3">Last data update: 14:30 IST</span>
        </div>

        <div class="active-threat-pill">
          <div class="threat-alert-box">
            <svg viewBox="0 0 24 24" class="w-4 h-4 fill-red-400 inline mr-1.5"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
            <span class="text-red-200 font-semibold text-xs">High risk zone detected in Sector B</span>
          </div>
          <button class="view-details-btn" id="btn-view-alert-details">View Details</button>
        </div>
      </footer>

      <!-- EMERGENCY REPORT & DETAILS MODAL -->
      <div class="sim-modal-backdrop" id="sim-report-modal" style="display: none;">
        <div class="sim-modal-card">
          <div class="sim-modal-header">
            <div class="flex items-center">
              <span class="text-xl mr-2">📋</span>
              <h2 class="text-lg font-bold text-white">Landslide Simulation & Impact Dossier</h2>
            </div>
            <button class="sim-modal-close" id="btn-close-modal">✕</button>
          </div>
          <div class="sim-modal-body">
            <div class="modal-summary-badge">
              <div>
                <span class="text-xs text-slate-400 uppercase tracking-wide">ISO 8601 Timestamp</span>
                <div class="font-mono text-sm text-sky-300">2026-09-11T14:30:00+05:30</div>
              </div>
              <div>
                <span class="text-xs text-slate-400 uppercase tracking-wide">Bayesian Ensemble Risk</span>
                <div class="font-mono text-sm text-red-400 font-bold">78.4% ± 3.8% (FoS: 0.88)</div>
              </div>
              <div>
                <span class="text-xs text-slate-400 uppercase tracking-wide">Telemetry Protocol</span>
                <div class="font-mono text-sm text-emerald-400">Active Spatiotemporal Kriging</div>
              </div>
            </div>

            <div class="modal-section-title">Critical Evacuation & Isochrone Window</div>
            <div class="evac-grid">
              <div class="evac-stat-box">
                <span class="stat-lbl">Population Exposure</span>
                <span class="stat-val text-red-400">1,420 Residents</span>
              </div>
              <div class="evac-stat-box">
                <span class="stat-lbl">Golden Response Window</span>
                <span class="stat-val text-amber-400">45 Minutes</span>
              </div>
              <div class="evac-stat-box">
                <span class="stat-lbl">Designated Safe Shelters</span>
                <span class="stat-val text-emerald-400">3 Facilities Ready</span>
              </div>
            </div>

            <div class="modal-section-title mt-4">Actionable Incident Protocols</div>
            <ol class="incident-action-list">
              <li><strong>Emergency Corridor Cleared:</strong> Immediate diversion of Munnar Road SH-17 traffic via Eastern Bypass Ridge.</li>
              <li><strong>Debris Interception:</strong> Mobilize heavy earthmovers (JCB/Excavator) to Kundala River culvert choke point.</li>
              <li><strong>Automated Siren Broadcast:</strong> Dispatch CAP-compliant multi-lingual SMS alerts to Sectors B & C.</li>
            </ol>
          </div>
          <div class="sim-modal-footer">
            <button class="modal-export-btn" id="btn-export-dossier">
              <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5 inline fill-current"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Export ISO-8601 PDF Report
            </button>
            <button class="modal-dismiss-btn" id="btn-dismiss-modal">Close</button>
          </div>
        </div>
      </div>

    </div>
    `;
  }

  attachEventListeners() {
    // 1. Region Switcher
    const regionSelect = document.getElementById('sim-region-selector');
    if (regionSelect) {
      regionSelect.addEventListener('change', (e) => {
        this.currentRegionKey = e.target.value;
        const preset = REGIONAL_PRESETS[this.currentRegionKey];
        const subtext = document.getElementById('sim-region-subtext');
        if (subtext) subtext.innerText = `${preset.name} | Real-time Data | Predictive Analytics | 3D Visualization`;

        if (this.simView) {
          this.simView.switchRegion(this.currentRegionKey);
        }
        this.updateDashboardMetrics(this.currentStep);
      });
    }

    // 2. 2D / 3D / Terrain View Mode Pills
    const viewButtons = document.querySelectorAll('.viewmode-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        viewButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const mode = e.target.getAttribute('data-mode');
        if (this.simView) this.simView.setViewMode(mode);
      });
    });

    // 3. Timeline Scrubber Range Input
    const scrubber = document.getElementById('t-scrubber-range');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        const step = parseInt(e.target.value, 10);
        this.seekToStep(step);
      });
    }

    // 4. Play / Pause Button
    const playBtn = document.getElementById('t-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.togglePlayback();
      });
    }

    // 5. Step Prev / Next
    const prevBtn = document.getElementById('t-step-prev');
    const nextBtn = document.getElementById('t-step-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.seekToStep(Math.max(0, this.currentStep - 1));
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.seekToStep(Math.min(6, this.currentStep + 1));
      });
    }

    // 6. Playback Speed Selector
    const speedSelect = document.getElementById('t-speed-select');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.playbackSpeed = parseFloat(e.target.value);
        if (this.isPlaying) {
          this.stopPlayback();
          this.startPlayback();
        }
      });
    }

    // 7. Filmstrip Clicks
    const filmCards = document.querySelectorAll('.filmstrip-card');
    filmCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const idx = parseInt(card.getAttribute('data-idx'), 10);
        this.seekToStep(idx);
      });
    });

    // 8. Animation Toggles
    const chkFlow = document.getElementById('chk-anim-flow');
    const chkContours = document.getElementById('chk-anim-contours');
    const btnReplay = document.getElementById('btn-anim-replay');

    if (chkFlow) {
      chkFlow.addEventListener('change', (e) => {
        if (this.simView) this.simView.toggleLayer('flowPath', e.target.checked);
      });
    }
    if (chkContours) {
      chkContours.addEventListener('change', (e) => {
        if (this.simView) this.simView.toggleLayer('contours', e.target.checked);
      });
    }
    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        this.seekToStep(0);
        if (!this.isPlaying) this.togglePlayback();
      });
    }

    // 9. Layer Checkboxes in Left Sidebar
    const layerSat = document.getElementById('layer-chk-satellite');
    const layerDem = document.getElementById('layer-chk-dem');
    const layerRisk = document.getElementById('layer-chk-risk-zones');

    if (layerSat) {
      layerSat.addEventListener('change', (e) => {
        if (this.simView) this.simView.toggleLayer('satellite', e.target.checked);
      });
    }
    if (layerDem) {
      layerDem.addEventListener('change', (e) => {
        if (this.simView) this.simView.toggleLayer('dem', e.target.checked);
      });
    }
    if (layerRisk) {
      layerRisk.addEventListener('change', (e) => {
        if (this.simView) this.simView.toggleLayer('riskZones', e.target.checked);
      });
    }

    // 10. Scenario Tabs
    const scenTabs = document.querySelectorAll('.scen-tab');
    scenTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        scenTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.currentScenarioTab = e.target.getAttribute('data-tab');
        this.renderScenarioTable();
      });
    });

    // 11. Modal Details Triggers
    const btnViewDetails = document.getElementById('btn-view-alert-details');
    const modal = document.getElementById('sim-report-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnDismissModal = document.getElementById('btn-dismiss-modal');
    const btnExportDossier = document.getElementById('btn-export-dossier');

    if (btnViewDetails && modal) {
      btnViewDetails.addEventListener('click', () => { modal.style.display = 'flex'; });
    }
    if (btnCloseModal && modal) {
      btnCloseModal.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (btnDismissModal && modal) {
      btnDismissModal.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (btnExportDossier) {
      btnExportDossier.addEventListener('click', () => {
        window.print();
      });
    }

    // 12. Left panel collapse toggle
    const btnCollapse = document.getElementById('layers-collapse-toggle');
    const layersPanel = document.getElementById('sim-layers-panel');
    if (btnCollapse && layersPanel) {
      btnCollapse.addEventListener('click', () => {
        layersPanel.classList.toggle('collapsed');
      });
    }

    // 13. Map Tools — wired lazily since the map initializes async
    this._wireMapTools();
  }

  _wireMapTools() {
    const getMap = () => this.simView && this.simView.map;
    let activeTool = null;
    let measurePoints = [];
    let drawPoints = [];
    let measureSourceId = 'sim-measure-src';
    let drawSourceId = 'sim-draw-src';
    let measureLayerId = 'sim-measure-layer';
    let drawLayerId = 'sim-draw-layer';
    let drawPopup = null;

    const clearActiveTool = () => {
      activeTool = null;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      measurePoints = [];
      drawPoints = [];
      const m = getMap();
      if (m && m.getCanvas) m.getCanvas().style.cursor = '';
    };

    const setActiveTool = (toolId) => {
      if (activeTool === toolId) { clearActiveTool(); return; }
      clearActiveTool();
      activeTool = toolId;
      const btn = document.getElementById('tool-' + toolId);
      if (btn) btn.classList.add('active');
      const m = getMap();
      if (m && m.getCanvas) m.getCanvas().style.cursor = 'crosshair';
    };

    // Pan — restore default drag interaction
    const panBtn = document.getElementById('tool-pan');
    if (panBtn) panBtn.addEventListener('click', () => {
      clearActiveTool();
      const m = getMap();
      if (m) m.dragPan.enable();
    });

    // Zoom In / Zoom Out
    const zoomInBtn = document.getElementById('tool-zoom-in');
    const zoomOutBtn = document.getElementById('tool-zoom-out');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
      const m = getMap(); if (m) m.zoomIn({ duration: 400 });
    });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
      const m = getMap(); if (m) m.zoomOut({ duration: 400 });
    });

    // Draw — freehand pencil boundary (mousedown → drag → mouseup)
    const drawBtn = document.getElementById('tool-draw');
    if (drawBtn) drawBtn.addEventListener('click', () => {
      if (activeTool === 'draw') { clearActiveTool(); return; }
      clearActiveTool();
      activeTool = 'draw';
      drawBtn.classList.add('active');
      const m = getMap();
      if (m && m.getCanvas) m.getCanvas().style.cursor = 'crosshair';
      drawPoints = [];
    });

    // Identify — click to show feature info
    const identifyBtn = document.getElementById('tool-identify');
    if (identifyBtn) identifyBtn.addEventListener('click', () => setActiveTool('identify'));

    // Freehand drawing on the 3D map canvas
    const simContainer = document.getElementById('simulation-map-container');
    if (simContainer) {
      let isDrawing = false;
      const minPixelDist = 8; // minimum pixel gap between points

      const toLngLat = (e) => {
        const m = getMap(); if (!m) return null;
        const rect = simContainer.getBoundingClientRect();
        return m.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      };

      const updateLiveLine = (pts) => {
        if (!getMap()) return;
        const m = getMap();
        const srcId = 'sim-draw-src';
        const lyrId = 'sim-draw-layer';
        if (m.getSource(srcId)) m.removeSource(srcId);
        if (m.getLayer(lyrId)) m.removeLayer(lyrId);
        if (m.getLayer(lyrId + '-stroke')) m.removeLayer(lyrId + '-stroke');
        if (pts.length < 2) return;
        m.addSource(srcId, { type: 'geojson', data: {
          type: 'FeatureCollection', features: [{
            type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]].map(p => [p.lng, p.lat])] }
          }]
        }});
        m.addLayer({ id: lyrId, type: 'fill', source: srcId, paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.18 } });
        m.addLayer({ id: lyrId + '-stroke', type: 'line', source: srcId, paint: { 'line-color': '#f59e0b', 'line-width': 2 } });
      };

      const onMouseDown = (e) => {
        if (activeTool !== 'draw') return;
        if (e.button !== 0) return; // left button only
        isDrawing = true;
        drawPoints = [];
        const pt = toLngLat(e);
        if (pt) drawPoints.push(pt);
      };

      const onMouseMove = (e) => {
        if (!isDrawing || activeTool !== 'draw') return;
        const pt = toLngLat(e);
        if (!pt) return;
        const last = drawPoints[drawPoints.length - 1];
        const m = getMap(); if (!m) return;
        const p1 = m.project([last.lng, last.lat]);
        const p2 = m.project([pt.lng, pt.lat]);
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        if (dx * dx + dy * dy >= minPixelDist * minPixelDist) {
          drawPoints.push(pt);
          updateLiveLine(drawPoints);
        }
      };

      const onMouseUp = (e) => {
        if (!isDrawing || activeTool !== 'draw') return;
        isDrawing = false;
        if (drawPoints.length >= 3) {
          // Compute enclosed area via shoelace formula
          const area = Math.abs(drawPoints.reduce((s, p, i) => {
            const n = drawPoints[(i + 1) % drawPoints.length];
            return s + p.lng * n.lat - n.lng * p.lat;
          }, 0) / 2);
          const latMid = drawPoints.reduce((s, p) => s + p.lat, 0) / drawPoints.length;
          const areaKm2 = area * ((111320 * Math.cos(latMid * Math.PI / 180)) / 1000) ** 2;
          const center = drawPoints.reduce((c, p) => ({ lng: c.lng + p.lng / drawPoints.length, lat: c.lat + p.lat / drawPoints.length }), { lng: 0, lat: 0 });
          this._showToolPopup(getMap(), center, `✏️ Enclosed area: ${areaKm2.toFixed(2)} km² (${drawPoints.length} boundary points)`);
        }
        drawPoints = [];
      };

      simContainer.addEventListener('mousedown', onMouseDown);
      simContainer.addEventListener('mousemove', onMouseMove);
      simContainer.addEventListener('mouseup', onMouseUp);
      // Also handle click for Identify
      simContainer.addEventListener('click', (e) => {
        const m = getMap();
        if (!m || activeTool !== 'identify') return;
        const pt = toLngLat(e);
        if (pt) this._showToolPopup(m, pt, `ℹ️ Coordinates: ${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E`);
      });
    }
  }

  _showToolPopup(map, latlng, text) {
    if (!map || !maplibregl) return;
    const popup = new maplibregl.Popup({ offset: 12, closeButton: true, className: 'sim-tool-popup' })
      .setLngLat(latlng)
      .setHTML(`<div style="font-size:12px;color:#e9eef5;padding:2px;">${text}</div>`)
      .addTo(map);
    setTimeout(() => popup.remove(), 8000);
  }

  seekToStep(step) {
    this.currentStep = step;

    // Update range input
    const scrubber = document.getElementById('t-scrubber-range');
    if (scrubber) scrubber.value = step;

    // Update tick labels active state
    const ticks = document.querySelectorAll('.tick-lbl');
    ticks.forEach(t => {
      const idx = parseInt(t.getAttribute('data-idx'), 10);
      t.classList.toggle('active', idx === step);
    });

    // Update filmstrip card active state
    const filmCards = document.querySelectorAll('.filmstrip-card');
    filmCards.forEach(c => {
      const idx = parseInt(c.getAttribute('data-idx'), 10);
      c.classList.toggle('active', idx === step);
    });

    // Update 3D Map
    if (this.simView) {
      this.simView.setTimelineStep(step);
    }

    // Update Metrics
    this.updateDashboardMetrics(step);
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    this.isPlaying = true;
    const playBtn = document.getElementById('t-play-btn');
    if (playBtn) {
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" class="w-5 h-5 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    }

    const intervalMs = 1800 / this.playbackSpeed;
    this.playTimer = setInterval(() => {
      let next = this.currentStep + 1;
      if (next > 6) next = 0;
      this.seekToStep(next);
    }, intervalMs);
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playTimer) clearInterval(this.playTimer);
    const playBtn = document.getElementById('t-play-btn');
    if (playBtn) {
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" class="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>';
    }
  }

  updateDashboardMetrics(stepIndex) {
    const progression = getTemporalProgression(this.currentRegionKey);
    const currentFrame = progression[stepIndex] || progression[6];
    const preset = REGIONAL_PRESETS[this.currentRegionKey] || REGIONAL_PRESETS.nilgiris;
    const impacts = getInfrastructureImpacts(this.currentRegionKey, currentFrame.risk);

    // 1. Donut Chart & Percentage
    const pctVal = document.getElementById('risk-pct-val');
    const levelTag = document.getElementById('risk-level-tag');
    const donutFg = document.getElementById('risk-donut-fg');
    if (pctVal) pctVal.innerText = `${currentFrame.risk}%`;
    if (levelTag) {
      levelTag.innerText = `${currentFrame.severity} Risk`;
      levelTag.className = `donut-level font-bold ${
        currentFrame.risk >= 75 ? 'text-red-500' :
        currentFrame.risk >= 50 ? 'text-orange-500' :
        currentFrame.risk >= 20 ? 'text-amber-400' : 'text-emerald-400'
      }`;
    }
    if (donutFg) {
      // Circumference = 2 * PI * 50 ~= 314.15
      const offset = 314.15 * (1 - currentFrame.risk / 100);
      donutFg.style.strokeDashoffset = offset;
      donutFg.style.stroke = currentFrame.risk >= 75 ? '#dc2626' : currentFrame.risk >= 50 ? '#ea580c' : '#f59e0b';
    }

    // 2. Current Conditions
    const elRain = document.getElementById('cond-rain');
    const elSlope = document.getElementById('cond-slope');
    const elMoisture = document.getElementById('cond-moisture');
    const elSoil = document.getElementById('cond-soil');
    const elSeismic = document.getElementById('cond-seismic');
    const elBedrock = document.getElementById('cond-bedrock');

    if (elRain) elRain.innerText = `${currentFrame.rain} mm`;
    if (elSlope) elSlope.innerText = `${preset.slopeAngle}°`;
    if (elMoisture) elMoisture.innerText = `${currentFrame.moisture}%`;
    if (elSoil) elSoil.innerText = preset.soilType;
    if (elSeismic) elSeismic.innerText = preset.seismicActivity;
    if (elBedrock) elBedrock.innerText = `${preset.bedrockDepth} m`;

    // 3. Infrastructure Impact KPIs
    const rNum = document.getElementById('infra-roads-num');
    const rKm = document.getElementById('infra-roads-km');
    const bNum = document.getElementById('infra-bld-num');
    const brNum = document.getElementById('infra-bridges-num');
    const pNum = document.getElementById('infra-power-num');
    const tNum = document.getElementById('infra-towers-num');
    const wNum = document.getElementById('infra-water-num');

    if (rNum) rNum.innerText = impacts.roads.count;
    if (rKm) rKm.innerText = `(${impacts.roads.lengthKm} km)`;
    if (bNum) bNum.innerText = impacts.buildings.count;
    if (brNum) brNum.innerText = impacts.bridges.count;
    if (pNum) pNum.innerText = impacts.powerLines.count;
    if (tNum) tNum.innerText = impacts.telecomTowers.count;
    if (wNum) wNum.innerText = impacts.waterPipelines.count;

    // 4. Update Progression Chart
    this.updateProgressionChartHighlight(stepIndex);

    // 5. Render Scenario Table
    this.renderScenarioTable();
  }

  initRiskProgressionChart() {
    const canvas = document.getElementById('risk-progression-canvas');
    if (!canvas) return;

    const progression = getTemporalProgression(this.currentRegionKey);
    const labels = progression.map(p => p.time);
    const dataPoints = progression.map(p => p.risk);

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.02)');

    this.progressionChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: dataPoints,
          borderColor: '#f97316',
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: labels.map((_, i) => i === 6 ? '#ef4444' : '#f97316'),
          pointBorderColor: '#fff',
          pointRadius: labels.map((_, i) => i === 6 ? 6 : 3.5),
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#94a3b8',
            bodyColor: '#fff',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `Risk Score: ${ctx.parsed.y}% (Pore Pressure Critical)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 10 } }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25, color: '#64748b', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          }
        }
      }
    });
  }

  updateProgressionChartHighlight(stepIndex) {
    if (!this.progressionChart) return;
    const progression = getTemporalProgression(this.currentRegionKey);
    const dataPoints = progression.map(p => p.risk);

    this.progressionChart.data.datasets[0].data = dataPoints;
    this.progressionChart.data.datasets[0].pointRadius = dataPoints.map((_, i) => i === stepIndex ? 6.5 : 3.5);
    this.progressionChart.data.datasets[0].pointBackgroundColor = dataPoints.map((_, i) => i === stepIndex ? '#ef4444' : '#f97316');
    this.progressionChart.update('none');
  }

  renderScenarioTable() {
    const tbody = document.getElementById('scenario-tbody');
    const paramHeader = document.getElementById('scen-col-param');
    if (!tbody) return;

    const matrix = getScenarioMatrix(this.currentRegionKey);
    const scenarios = matrix[this.currentScenarioTab] || matrix.rainfall;

    if (paramHeader) {
      paramHeader.innerText = this.currentScenarioTab === 'rainfall' ? 'Rainfall (24h)' :
                              this.currentScenarioTab === 'seismic' ? 'Seismic PGA' : 'Compound Hazard';
    }

    tbody.innerHTML = scenarios.map(s => `
      <tr>
        <td class="font-medium text-slate-200">${s.name}</td>
        <td class="font-mono text-xs text-sky-300">${s.paramValue}</td>
        <td>
          <span class="scen-prob-badge ${s.probClass}">
            ${s.prob}%
          </span>
        </td>
        <td class="font-mono text-xs text-amber-200">${s.runout}</td>
        <td class="font-mono text-xs text-center text-slate-200">${s.impactedRoads}</td>
      </tr>
    `).join('');
  }

  /**
   * Draw dynamic terrain mini snapshots on the 7 filmstrip canvases
   */
  initMiniThumbnails() {
    const canvases = document.querySelectorAll('.thumb-canvas');
    canvases.forEach((canvas, idx) => {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Dark mountain base gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#13281e');
      bgGrad.addColorStop(0.6, '#1e3a2b');
      bgGrad.addColorStop(1, '#0f171c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Mountain ridge contours
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.quadraticCurveTo(w * 0.4, h * 0.3, w, h * 0.5);
      ctx.stroke();

      // Landslide scar shape growing progressively with index
      const growth = (idx + 1) / 7;
      const scarGrad = ctx.createRadialGradient(w * 0.5, h * 0.25, 2, w * 0.5, h * 0.4 + growth * 15, growth * 22);
      scarGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
      scarGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.75)');
      scarGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');

      ctx.fillStyle = scarGrad;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.3 + growth * 10, 6 + growth * 8, 10 + growth * 16, Math.PI / 12, 0, Math.PI * 2);
      ctx.fill();

      // Mini flow line
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.25);
      ctx.lineTo(w * 0.52, h * 0.3 + growth * 16);
      ctx.stroke();
    });
  }

  /** Live IST clock — ticks every second in the sim header. */
  startLiveClock() {
    const el = document.getElementById('sim-live-clock');
    if (!el) return;
    const fmt = () => new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).replace(',', ' ·') + ' IST';
    el.textContent = fmt();
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._clockTimer = setInterval(() => { el.textContent = fmt(); }, 1000);
  }

  async handleCustomLocationSelected(info) {
    const { lng, lat, elevation, slope } = info;

    // 1. Update topbar subtitle
    const subtextEl = document.getElementById('sim-region-subtext');
    if (subtextEl) {
      subtextEl.innerHTML = `<span style="color:#38bdf8; font-weight:700;">📍 Selected Area:</span> ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E | Elev: <strong>${elevation} m</strong> | Slope: <strong>${slope}°</strong> | <em>Live Topographic Synthesis</em>`;
    }

    // 2. Synthesize realistic dynamic local parameters
    const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233));
    const localRainfall = Math.round(115 + seed * 90);
    const localMoisture = Math.round(78 + seed * 19);
    const localPGA = parseFloat((0.10 + seed * 0.24).toFixed(2));

    // 2b. Real-ML probability from the trained GBDT (browser ONNX → API → heuristic)
    const mlFeatures = {
      rain_1d: localRainfall,
      rain_3d: Math.round(localRainfall * 2.2),
      rain_7d: Math.round(localRainfall * 3.6),
      rain_15d: Math.round(localRainfall * 5),
      rain_max_7d: localRainfall,
      elevation_m: elevation,
      slope_deg: slope
    };
    const mlResult = await predictLandslideProbability(mlFeatures);

    // 3. Compute dynamic ensemble risk (fused with the real model)
    const ensemble = calculateEnsembleRisk(
      this.currentRegionKey, localRainfall, localMoisture, localPGA, mlResult.probability);

    // 4. Update Donut Gauge
    const donutVal = document.getElementById('risk-pct-val');
    const donutLevel = document.getElementById('risk-level-tag');
    const donutFg = document.getElementById('risk-donut-fg');

    if (donutVal) donutVal.innerText = `${ensemble.probabilityPct}%`;
    if (donutLevel) {
      donutLevel.innerText = `${ensemble.severity} Risk`;
      donutLevel.style.color = ensemble.badgeColor;
    }
    if (donutFg) {
      const circ = 314.15;
      const offset = circ - (circ * ensemble.probabilityPct) / 100;
      donutFg.style.strokeDashoffset = offset;
      donutFg.style.stroke = ensemble.badgeColor;
    }

    // 4b. ML provenance badge — shows the ensemble is fused with the trained model
    const mlBadge = document.getElementById('risk-donut-ml-source');
    if (mlBadge) {
      const srcLabel = mlResult.source === 'onnx-browser'
        ? '🤖 Real-ML: GBDT (in-browser ONNX)'
        : mlResult.source === 'fastapi' ? '🤖 Real-ML: GBDT (FastAPI)'
        : '🤖 ML: local heuristic fallback';
      mlBadge.textContent = srcLabel;
      mlBadge.title = `Model: ${mlResult.model} · pML=${(mlResult.probability * 100).toFixed(1)}% fused at 45% into the ensemble`;
    }

    // 5. Update Current Conditions cards
    const elRain = document.getElementById('cond-rain');
    const elSlope = document.getElementById('cond-slope');
    const elMoisture = document.getElementById('cond-moisture');
    const elBedrock = document.getElementById('cond-bedrock');

    if (elRain) elRain.innerText = `${localRainfall} mm`;
    if (elSlope) elSlope.innerText = `${slope}°`;
    if (elMoisture) elMoisture.innerText = `${localMoisture}%`;
    if (elBedrock) elBedrock.innerText = `${Math.round(8 + seed * 14)} m`;

    // 6. Update Infrastructure KPIs
    const impacts = getInfrastructureImpacts(this.currentRegionKey, ensemble.probabilityPct);
    const rNum = document.getElementById('infra-roads-num');
    const rKm = document.getElementById('infra-roads-km');
    const bNum = document.getElementById('infra-bld-num');
    const brNum = document.getElementById('infra-bridges-num');

    if (rNum) rNum.innerText = impacts.roads.count;
    if (rKm) rKm.innerText = `(${impacts.roads.lengthKm} km)`;
    if (bNum) bNum.innerText = impacts.buildings.count;
    if (brNum) brNum.innerText = impacts.bridges.count;

    // 7. Update bottom alert status
    const alertBox = document.querySelector('.threat-alert-box span:nth-child(2)');
    if (alertBox) {
      alertBox.innerText = `Road Connectivity Risk Active: ${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E (FoS ${ensemble.fos})`;
    }

    // 8. Real-time road connectivity around the selected point (OSM live)
    this.loadRoadConnectivity(lat, lng, ensemble);
  }

  /**
   * Fetch the real road network around the selected location and render the
   * Road Connectivity panel + compute which roads intersect the modelled
   * high-hazard zone (slope/FoS-driven radius around the click).
   */
  async loadRoadConnectivity(lat, lng, ensemble) {
    const RISK_KM = 2.5 + (ensemble.probabilityPct / 100) * 4.5; // 2.5–7 km hazard radius
    const dLat = RISK_KM / 110.54;
    const dLon = RISK_KM / (111.32 * Math.cos(lat * Math.PI / 180));
    const bbox = { minLat: lat - dLat, maxLat: lat + dLat, minLon: lng - dLon, maxLon: lng + dLon };
    const panel = {
      status: document.getElementById('roadnet-status'),
      total: document.getElementById('roadnet-total'),
      km: document.getElementById('roadnet-km'),
      atrisk: document.getElementById('roadnet-atrisk'),
      list: document.getElementById('roadnet-list')
    };
    if (!panel.list) return;
    if (panel.status) { panel.status.textContent = 'loading…'; panel.status.className = 'roadnet-status'; }

    // cache per rounded coordinate so re-clicks don't refetch
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    this._roadCache = this._roadCache || new Map();
    let net = this._roadCache.get(cacheKey);
    if (!net) {
      net = await fetchRoadsForBbox(bbox);
      this._roadCache.set(cacheKey, net);
      if (this._roadCache.size > 12) this._roadCache.delete(this._roadCache.keys().next().value);
    }
    if (!panel.total) return;
    panel.total.textContent = net.roads.length;
    panel.km.textContent = net.totalKm.toFixed(1);

    if (!net.roads.length) {
      if (panel.status) { panel.status.textContent = 'no road data'; panel.status.className = 'roadnet-status'; }
      panel.list.innerHTML = '<li class="roadnet-empty">No mapped roads in this area (remote terrain).</li>';
      const rNum = document.getElementById('infra-roads-num');
      const rKm = document.getElementById('infra-roads-km');
      if (rNum) rNum.innerText = '0';
      if (rKm) rKm.innerText = '(0 km)';
      return;
    }

    // Roads at risk = those entering the hazard circle around the click point.
    const atRisk = [];
    for (const road of net.roads) {
      let minD = Infinity;
      for (const p of road.pts) {
        const dy = (p.lat - lat) * 110.54;
        const dx = (p.lon - lng) * 111.32 * Math.cos(lat * Math.PI / 180);
        const d = Math.hypot(dx, dy);
        if (d < minD) minD = d;
      }
      if (minD <= RISK_KM) atRisk.push({ road, minD });
    }
    atRisk.sort((a, b) => a.road.meta.priority - b.road.meta.priority || a.minD - b.minD);

    panel.atrisk.textContent = atRisk.length;
    if (panel.status) {
      panel.status.textContent = atRisk.length ? `${atRisk.length} exposed` : 'all clear';
      panel.status.className = 'roadnet-status ' + (atRisk.length ? 'bad' : 'ok');
    }

    // Wire the Affected Infrastructure road KPI to REAL numbers now.
    const rNum = document.getElementById('infra-roads-num');
    const rKm = document.getElementById('infra-roads-km');
    if (rNum) rNum.innerText = atRisk.length;
    if (rKm) rKm.innerText = `(${atRisk.reduce((s, r) => s + r.road.lengthKm, 0).toFixed(1)} km)`;

    const rows = atRisk.slice(0, 7).map(({ road, minD }) => `
      <li class="roadnet-item ${road.meta.priority <= 2 ? 'major' : ''}">
        <span class="roadnet-dot" style="background:${'#' + road.meta.color.toString(16).padStart(6, '0')}"></span>
        <span class="roadnet-name" title="${road.name} (${road.meta.label})">${road.name}</span>
        <span class="roadnet-meta">${road.lengthKm.toFixed(1)} km · ${minD < 1 ? '<1' : Math.round(minD)} km from point</span>
        <span class="roadnet-badge">${minD < RISK_KM * 0.45 ? 'DIRECT HIT' : 'AT RISK'}</span>
      </li>`).join('');
    panel.list.innerHTML = rows || '<li class="roadnet-empty">No roads within the hazard radius.</li>';
  }

  destroy() {
    this.stopPlayback();
    if (this.progressionChart) {
      this.progressionChart.destroy();
      this.progressionChart = null;
    }
    if (this.simView) {
      this.simView.destroy();
      this.simView = null;
    }
  }
}
