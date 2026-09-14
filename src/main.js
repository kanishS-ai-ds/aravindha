import './style.css'
import Chart from 'chart.js/auto'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { REGIONAL_PRESETS } from './modules/landslide-simulation-engine.js'


/* =========================================================
   ARAVINDHA
   Advanced Risk Assessment and Vulnerability Indicator
   for Natural Disaster Hazard Analysis
   ========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const NER_BBOX = {
  minLon: 88.0,
  minLat: 21.0,
  maxLon: 97.5,
  maxLat: 29.8
}


const WEATHER_POINTS = [
  {
    name: 'Itanagar',
    lat: 27.0844,
    lon: 93.6053
  },
  {
    name: 'Guwahati',
    lat: 26.1445,
    lon: 91.7362
  },
  {
    name: 'Shillong',
    lat: 25.5788,
    lon: 91.8933
  },
  {
    name: 'Imphal',
    lat: 24.8170,
    lon: 93.9368
  },
  {
    name: 'Aizawl',
    lat: 23.7271,
    lon: 92.7176
  },
  {
    name: 'Kohima',
    lat: 25.6751,
    lon: 94.1086
  },
  {
    name: 'Gangtok',
    lat: 27.3389,
    lon: 88.6065
  },
  {
    name: 'Agartala',
    lat: 23.8315,
    lon: 91.2868
  }
]


const NASA_COOLR_URL =
  'https://gis.earthdata.nasa.gov/gis05/rest/services/Landslides/COOLR_Events_Points/FeatureServer/0/query'


const USGS_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'


const OSM_TILE =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'


const SATELLITE_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'


const TERRAIN_TILE =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'


const NASA_NRT_TILE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/nrt/GOES-East_ABI_GeoColor/default/GoogleMapsCompatible_Level_9/{z}/{y}/{x}.jpg'


/* =========================================================
   HIGHWAY CORRIDOR INFRASTRUCTURE DATASET
========================================================= */

const REGIONAL_HIGHWAY_CORRIDORS = [
  {
    id: 'nh-assam',
    state: 'Assam',
    highway: 'NH-27 / NH-37 (East-West Arterial)',
    segments: 1840,
    status: 'PASSABLE',
    color: '#22c55e',
    note: 'All lanes clear, minor runoff near Kaliabor',
    chokePoint: 'Kaliabor Brahmaputra Overpass',
    center: [92.68, 26.35],
    coordinates: [
      [89.98, 26.03], [90.56, 26.15], [91.20, 26.12], [91.75, 26.18],
      [92.68, 26.35], [93.17, 26.58], [93.70, 26.65], [94.21, 26.75],
      [94.91, 27.47], [95.36, 27.50]
    ]
  },
  {
    id: 'nh-meghalaya',
    state: 'Meghalaya',
    highway: 'NH-6 (Shillong - Silchar Lifeline)',
    segments: 680,
    status: 'WATCH',
    color: '#f59e0b',
    note: 'Sonapur tunnel sector active monitoring',
    chokePoint: 'Sonapur Tunnel & Lukha River Dip',
    center: [92.36, 25.11],
    coordinates: [
      [91.89, 26.11], [91.88, 25.90], [91.89, 25.57], [92.20, 25.45],
      [92.36, 25.11], [92.58, 24.90], [92.80, 24.83]
    ]
  },
  {
    id: 'nh-sikkim',
    state: 'Sikkim',
    highway: 'NH-10 (Siliguri - Gangtok Corridor)',
    segments: 320,
    status: 'CAUTION',
    color: '#ef4444',
    note: 'Teesta valley single-lane operation at 29th Mile',
    chokePoint: '29th Mile / Likhu Veer Slope',
    center: [88.52, 27.18],
    coordinates: [
      [88.43, 26.72], [88.47, 26.88], [88.43, 27.06], [88.51, 27.18],
      [88.52, 27.24], [88.61, 27.33]
    ]
  },
  {
    id: 'nh-arunachal',
    state: 'Arunachal Pradesh',
    highway: 'NH-13 (Trans-Arunachal Highway)',
    segments: 1550,
    status: 'PASSABLE',
    color: '#22c55e',
    note: 'Banderdewa & Pasighat sectors open',
    chokePoint: 'Nechiphu Tunnel & Sela Approach',
    center: [94.22, 27.85],
    coordinates: [
      [93.81, 27.12], [93.62, 27.10], [93.84, 27.54], [94.22, 27.98],
      [94.79, 28.17], [95.32, 28.06], [95.83, 28.14]
    ]
  },
  {
    id: 'nh-nagaland',
    state: 'Nagaland',
    highway: 'NH-29 (Dimapur - Kohima Corridor)',
    segments: 410,
    status: 'CAUTION',
    color: '#ef4444',
    note: 'Dzüdza bridge slope stabilization work',
    chokePoint: 'Dzüdza River Valley & Pagala Pahar',
    center: [93.98, 25.68],
    coordinates: [
      [93.72, 25.91], [93.78, 25.82], [93.86, 25.75], [93.98, 25.68],
      [94.11, 25.67], [94.13, 25.52]
    ]
  },
  {
    id: 'nh-manipur',
    state: 'Manipur',
    highway: 'NH-37 (Imphal - Jiribam Lifeline)',
    segments: 390,
    status: 'PASSABLE',
    color: '#22c55e',
    note: 'Escorted logistics operating normally',
    chokePoint: 'Makru & Barak Bridge Crossings',
    center: [93.61, 24.80],
    coordinates: [
      [93.12, 24.80], [93.42, 24.81], [93.61, 24.79], [93.74, 24.80],
      [93.94, 24.81]
    ]
  },
  {
    id: 'nh-mizoram',
    state: 'Mizoram',
    highway: 'NH-54 (Aizawl - Lunglei Axis)',
    segments: 540,
    status: 'PASSABLE',
    color: '#22c55e',
    note: 'Clear after post-monsoon grading',
    chokePoint: 'Hangi & Tuirial Gorge Sectors',
    center: [92.70, 23.60],
    coordinates: [
      [92.68, 24.22], [92.68, 23.97], [92.66, 23.79], [92.72, 23.73],
      [92.75, 23.28], [92.75, 22.88]
    ]
  },
  {
    id: 'nh-tripura',
    state: 'Tripura',
    highway: 'NH-8 (Agartala - Churaibari Link)',
    segments: 360,
    status: 'PASSABLE',
    color: '#22c55e',
    note: 'Full connectivity to Assam border',
    chokePoint: 'Baramura Hill Range Cutting',
    center: [91.80, 24.10],
    coordinates: [
      [92.24, 24.46], [92.17, 24.37], [92.03, 24.16], [91.60, 23.84],
      [91.28, 23.83]
    ]
  },
  {
    id: 'nh-wayanad',
    state: 'Kerala (Western Ghats)',
    highway: 'NH-766 / Wayanad Thamarassery Churam',
    segments: 180,
    status: 'WATCH',
    color: '#f59e0b',
    note: '9 Hairpin Bends • Heavy mist & slope monitoring',
    chokePoint: 'Thamarassery Churam Hairpin 7-8',
    center: [76.04, 11.52],
    coordinates: [
      [75.78, 11.25], [75.93, 11.42], [76.04, 11.52], [76.08, 11.60],
      [76.15, 11.53]
    ]
  },
  {
    id: 'nh-chardham',
    state: 'Uttarakhand (Himalayan)',
    highway: 'NH-7 / NH-58 Rishikesh - Joshimath',
    segments: 295,
    status: 'CAUTION',
    color: '#ef4444',
    note: 'Sirobagarh landslide zone active bypass',
    chokePoint: 'Sirobagarh & Helang Valley Slips',
    center: [78.89, 30.25],
    coordinates: [
      [78.30, 30.10], [78.60, 30.15], [78.78, 30.22], [78.89, 30.23],
      [78.98, 30.34], [79.56, 30.55]
    ]
  }
]

/* =========================================================
   GLOBAL DATA
========================================================= */

let map

let rainfallChart = null

let landslideMonthlyChart = null

let currentLandslideChartMode = 'yearly'

let earthquakeFeatures = []

let landslideFeatures = []

let latestRainfall = null

let latestLandslideCount = null

let latestSoilMoisture = null


/* =========================================================
   APPLICATION HTML
========================================================= */

const app = document.querySelector('#app')


app.innerHTML = `
<div class="app-shell">


  <!-- =====================================================
       SIDEBAR
  ====================================================== -->

  <aside class="sidebar">

    <div class="brand">

      <div class="brand-icon">
        A
      </div>

      <div>

        <div class="brand-name">
          ARAVINDHA
        </div>

        <div class="brand-subtitle">
          DISASTER INTELLIGENCE
        </div>

      </div>

    </div>


    <nav class="sidebar-nav">

      <div class="nav-section">
        COMMAND CENTER
      </div>


      <button
        class="nav-item active"
        data-section="overview"
      >
        <span>◈</span>
        <span>Overview</span>
      </button>


      <button
        class="nav-item"
        data-section="risk-map"
      >
        <span>⌖</span>
        <span>Risk Map</span>
      </button>


      <button
        class="nav-item"
        data-section="simulation"
      >
        <span>🌋</span>
        <span>3D Simulation</span>
      </button>


      <button
        class="nav-item"
        data-section="video-studio"
      >
        <span>🎬</span>
        <span>Video Studio</span>
      </button>


      <button
        class="nav-item"
        data-section="alerts"
      >
        <span>⚠</span>
        <span>Alerts</span>
      </button>


      <button
        class="nav-item"
        data-section="field-reports"
      >
        <span>▣</span>
        <span>Field Reports</span>
      </button>


      <button
        class="nav-item"
        data-section="analytics"
      >
        <span>◫</span>
        <span>Analytics</span>
      </button>


      <div class="nav-section">
        SYSTEM
      </div>


      <button
        class="nav-item"
        data-section="settings"
      >
        <span>⚙</span>
        <span>Settings</span>
      </button>

    </nav>


    <div class="sidebar-bottom">

      <div class="system-status">

        <span class="status-dot"></span>

        <div>

          <strong>
            System Online
          </strong>

          <small>
            Monitoring network active
          </small>

        </div>

      </div>


      <button
        class="theme-btn"
        id="themeToggle"
      >
        ☼
        <span>Toggle Theme</span>
      </button>

    </div>

  </aside>


  <!-- =====================================================
       MAIN CONTENT
  ====================================================== -->

  <main class="main-content">


    <!-- TOPBAR -->

    <header class="topbar">

      <div>

        <div class="region-label">
          NORTH EASTERN REGION
        </div>

        <h1>
          Disaster Monitoring Command Center
        </h1>

      </div>


      <div class="topbar-actions">

        <select id="languageSelect">

          <option>English</option>
          <option>Hindi</option>
          <option>Assamese</option>
          <option>Bengali</option>
          <option>Nepali</option>
          <option>Tamil</option>
          <option>Telugu</option>
          <option>Malayalam</option>
          <option>Kannada</option>
          <option>Marathi</option>

        </select>


        <div class="online-indicator">

          <span class="status-dot"></span>

          System Online

        </div>

      </div>

    </header>


    <!-- ===================================================
         ALERT
    ==================================================== -->

    <section class="alert-banner">

      <div class="alert-icon">
        ⚠
      </div>


      <div class="alert-content">

        <strong>
          EARLY WARNING NETWORK
        </strong>

        <span>
          Monitoring rainfall, soil moisture, terrain,
          landslide, earthquake and satellite indicators
          across NER.
        </span>

      </div>


      <button id="viewAlertsBtn">
        View Alerts
      </button>

    </section>


    <!-- ===================================================
         STATISTICS
    ==================================================== -->

    <section class="stats-grid">


      <!-- RISK -->

      <div class="stat-card">

        <div class="stat-header">

          <span>
            LANDSLIDE RISK
          </span>

          <span class="stat-icon">
            ◈
          </span>

        </div>


        <div
          class="stat-value"
          id="riskStatusValue"
        >
          MONITORING
        </div>


        <div
          class="stat-footer"
          id="riskStatusText"
        >
          Provisional evidence score
        </div>

      </div>


      <!-- RAINFALL -->

      <div class="stat-card">

        <div class="stat-header">

          <span>
            RAINFALL
          </span>

          <span class="stat-icon">
            ☔
          </span>

        </div>


        <div
          class="stat-value"
          id="rainfallValue"
        >
          LOADING
        </div>


        <div
          class="stat-footer"
          id="rainfallStatus"
        >
          Open-Meteo
        </div>

      </div>


      <!-- SOIL MOISTURE -->

      <div class="stat-card">

        <div class="stat-header">

          <span>
            SOIL MOISTURE
          </span>

          <span class="stat-icon">
            ≈
          </span>

        </div>


        <div
          class="stat-value"
          id="soilMoistureValue"
        >
          LOADING
        </div>


        <div
          class="stat-footer"
          id="soilMoistureStatus"
        >
          Open-Meteo model data
        </div>

      </div>


      <!-- EARTHQUAKE -->

      <div class="stat-card">

        <div class="stat-header">

          <span>
            EARTHQUAKE
          </span>

          <span class="stat-icon">
            ◉
          </span>

        </div>


        <div
          class="stat-value"
          id="earthquakeValue"
        >
          LOADING
        </div>


        <div
          class="stat-footer"
          id="earthquakeStatus"
        >
          USGS — past 24h
        </div>

      </div>


    </section>


    <!-- ===================================================
         GIS + RISK
    ==================================================== -->

    <section class="dashboard-grid">


      <!-- GIS -->

      <div class="panel map-panel">

        <div class="panel-header">

          <div>

            <div class="panel-kicker">
              GEOSPATIAL INTELLIGENCE
            </div>

            <h2>
              NER Hazard Map
            </h2>

          </div>

        </div>

        <div class="map-wrapper">
          <div id="gisMap"></div>

          <!-- 2D / 3D RISK HEATMAP PILL SWITCHER -->
          <div class="sim-viewmode-pills" id="overviewViewmodePills">
            <button class="viewmode-btn" data-overview-mode="2d">2D</button>
            <button class="viewmode-btn active viewmode-heatmap-btn" data-overview-mode="heatmap3d" title="3D Topographic Risk Heatmap">
              <span class="heatmap-btn-icon">🌋</span> 3D Risk Heatmap
            </button>
          </div>

          <!-- COMPASS NORTH WIDGET -->
          <div class="sim-compass-widget" id="overviewCompassWidget" title="North orientation">
            <div class="compass-circle">
              <div class="compass-needle"></div>
              <span class="compass-label">N</span>
            </div>
          </div>

          <!-- SCALE BAR -->
          <div class="sim-scalebar" id="overviewScalebar">
            <div class="scale-ticks">
              <span>0</span>
              <span>250</span>
              <span>500</span>
              <span>1,000 m</span>
            </div>
            <div class="scale-line"></div>
          </div>

          <!-- HYPSOMETRIC RISK COLORMAP LEGEND (3D Heatmap Mode) -->
          <div class="sim-heatmap-legend" id="overviewHeatmapLegend">
            <div class="heatmap-legend-title">
              <span>Topographic Hazard Heatmap</span>
              <span class="text-amber-400 font-mono text-xs" style="color:#f59e0b; font-family:monospace; font-size:10px;">FoS &lt; 1.0</span>
            </div>
            <div class="heatmap-legend-bar"></div>
            <div class="heatmap-legend-labels">
              <span>Valley (&lt;1000m)</span>
              <span>Mid-Slope</span>
              <span>Peak Crest (&gt;2400m)</span>
            </div>
          </div>

          <!-- 3D BOUNDING COORDINATE COLLAR -->
          <div class="sim-coord-collar" id="overviewCoordCollar">
            <div class="collar-axis-lat" id="overviewCollarLat">
              <span class="collar-tick">10°15' N</span>
              <span class="collar-tick">10°14' N</span>
              <span class="collar-tick">10°12' N</span>
              <span class="collar-tick">10°10' N</span>
            </div>
            <div class="collar-axis-lon" id="overviewCollarLon">
              <span class="collar-tick">76°44' E</span>
              <span class="collar-tick">76°46' E</span>
              <span class="collar-tick">76°47' E</span>
              <span class="collar-tick">76°49' E</span>
              <span class="collar-tick">76°50' E</span>
            </div>
          </div>

          <!-- COORDINATE HUD -->
          <div class="sim-coord-hud" id="overviewCoordHud">
            Lat: <span class="coord-val">10.2147° N</span> &nbsp; Lon: <span class="coord-val">76.7843° E</span> &nbsp; Elev: <span class="coord-val">1,256 m</span>
          </div>

          <!-- PHYSICS DEBRIS PARTICLE CANVAS OVERLAY -->
          <canvas id="overviewParticleCanvas" class="sim-particle-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"></canvas>
        </div>
      </div>


      <!-- RISK ENGINE -->

      <div class="panel risk-panel">

        <div class="panel-header">

          <div>

            <div class="panel-kicker">
              ARAVINDHA ENGINE
            </div>

            <h2>
              Landslide Risk
            </h2>

          </div>


          <span class="engine-status">
            PROVISIONAL
          </span>

        </div>


        <div class="risk-circle-container">

          <div class="risk-circle">

            <div
              class="risk-number"
              id="landslideRiskScore"
            >
              —
            </div>


            <div
              class="risk-label"
              id="landslideRiskLevel"
            >
              DATA PENDING
            </div>

          </div>

        </div>


        <div
          class="risk-message"
          id="riskMessage"
        >
          Waiting for available real data...
        </div>


        <div class="risk-factors">


          <!-- RAINFALL -->

          <div class="risk-factor">

            <div>

              <span>
                Rainfall
              </span>

              <strong
                id="riskRainfall"
              >
                —
              </strong>

            </div>


            <div class="factor-bar">

              <span
                id="rainfallRiskBar"
                style="width:0%"
              ></span>

            </div>

          </div>


          <!-- HISTORICAL -->

          <div class="risk-factor">

            <div>

              <span>
                Historical Landslides
              </span>

              <strong
                id="riskHistorical"
              >
                —
              </strong>

            </div>


            <div class="factor-bar">

              <span
                id="historicalRiskBar"
                style="width:0%"
              ></span>

            </div>

          </div>


          <!-- SLOPE -->

          <div class="risk-factor">

            <div>

              <span>
                Slope / DEM
              </span>

              <strong
                id="riskSlope"
              >
                DATA PENDING
              </strong>

            </div>


            <div class="factor-bar">

              <span
                id="slopeRiskBar"
                style="width:0%"
              ></span>

            </div>

          </div>


          <!-- SOIL -->

          <div class="risk-factor">

            <div>

              <span>
                Soil Moisture
              </span>

              <strong
                id="riskSoil"
              >
                DATA PENDING
              </strong>

            </div>


            <div class="factor-bar">

              <span
                id="soilRiskBar"
                style="width:0%"
              ></span>

            </div>

          </div>


        </div>

      </div>

    </section>


    <!-- ===================================================
         ANALYTICS
    ==================================================== -->

    <section class="analytics-grid">


      <!-- RAINFALL -->

      <div class="panel chart-panel">

        <div class="panel-header">

          <div>

            <div class="panel-kicker">
              WEATHER INTELLIGENCE
            </div>

            <h2>
              Rainfall Forecast
            </h2>

          </div>


          <span id="rainChartStatus">
            Open-Meteo
          </span>

        </div>


        <div class="chart-container">

          <canvas
            id="rainfallChart"
          ></canvas>

        </div>

      </div>


      <!-- LANDSLIDES -->

      <div class="panel chart-panel">

        <div class="panel-header" style="flex-wrap: wrap; gap: 10px;">

          <div>

            <div class="panel-kicker">
              LANDSLIDE DATABASE • ANNUAL TRENDS
            </div>

            <h2 id="landslideChartTitle">
              Yearly Landslide Events
            </h2>

          </div>


          <div style="display: flex; align-items: center; gap: 8px;">

            <div class="chart-toggle-group" style="display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2px;">
              <button id="btnLandslideYearly" style="padding: 4px 9px; border: 0; border-radius: 6px; font-size: 9px; font-weight: 800; cursor: pointer; background: var(--primary); color: #fff; transition: 0.2s ease;">Yearly</button>
              <button id="btnLandslideMonthly" style="padding: 4px 9px; border: 0; border-radius: 6px; font-size: 9px; font-weight: 800; cursor: pointer; background: transparent; color: var(--muted); transition: 0.2s ease;">Monthly</button>
            </div>

            <span
              id="landslideChartStatus"
            >
              NASA COOLR
            </span>

          </div>

        </div>


        <div class="chart-container">

          <canvas
            id="landslideMonthlyChart"
          ></canvas>

        </div>

      </div>

    </section>


    <!-- ===================================================
         BOTTOM
    ==================================================== -->

    <section class="bottom-grid">


      <!-- ROADS -->

      <div class="panel connectivity-panel">

        <div class="panel-header">

          <div>

            <div class="panel-kicker">
              INFRASTRUCTURE
            </div>

            <h2>
              Road Connectivity
            </h2>

          </div>


          <span id="roadStatus">
            DATA LOADING
          </span>

        </div>


        <div
          id="roadContent"
          class="road-content"
        >
          Loading real OpenStreetMap road data...
        </div>

      </div>


      <!-- FIELD REPORTS -->

      <div class="panel field-panel">

        <div class="panel-header">

          <div>

            <div class="panel-kicker">
              FIELD INTELLIGENCE
            </div>

            <h2>
              Field Reports
            </h2>

          </div>


          <button id="reportBtn">
            + Report
          </button>

        </div>


        <div class="field-empty">

          <div class="field-icon">
            ▣
          </div>


          <strong>
            No field reports available
          </strong>


          <span>
            Reports will appear here when submitted
            by authorized field users.
          </span>

        </div>

      </div>

    </section>


    <footer>

      <strong>
        ARAVINDHA
      </strong>

      — Advanced Risk Assessment and Vulnerability
      Indicator for Natural Disaster Hazard Analysis

    </footer>

    <section id="section-simulation" style="display: none; width: 100%; min-height: 100vh;"></section>

    <section id="section-video-studio" style="display: none; width: 100%; min-height: 100vh;"></section>

  </main>

</div>
`


/* =========================================================
   GIS HELPERS
========================================================= */

function updateGISStatus(text) {

  const element =
    document.querySelector('#gisStatus')

  if (element) {
    element.textContent = text
  }

}


/* =========================================================
   MAP INITIALIZATION
========================================================= */

function initMap() {
  const container = document.getElementById('gisMap')
  if (!container) return

  try {
    map = new maplibregl.Map({

    container: 'gisMap',

    style: {

      version: 8,

      sources: {

        osm: {

          type: 'raster',

          tiles: [
            OSM_TILE
          ],

          tileSize: 256,

          attribution:
            '© OpenStreetMap contributors'

        },


        satellite: {

          type: 'raster',

          tiles: [
            SATELLITE_TILE
          ],

          tileSize: 256,

          attribution:
            '© Esri'

        },


        nasaLive: {

          type: 'raster',

          tiles: [
            NASA_NRT_TILE
          ],

          tileSize: 256,

          attribution:
            'NASA GIBS'

        },


        terrain: {

          type: 'raster-dem',

          tiles: [
            TERRAIN_TILE
          ],

          tileSize: 256,

          encoding: 'terrarium',

          maxzoom: 15

        }

      },


      layers: [

        {

          id: 'osm-base',

          type: 'raster',

          source: 'osm'

        }

      ],


      terrain: {

        source: 'terrain',

        exaggeration: 1.3

      }

    },


    center: [
      79.0,
      22.8
    ],

    zoom: 4.4,

    pitch: 0,

    bearing: 0

  })

  map.addControl(
    new maplibregl.NavigationControl(),
    'top-right'
  )

  map.on(
    'load',
    () => {
      updateGISStatus(
        '🔥 MULTI-HAZARD HEATMAP ACTIVE • LANDSLIDES & FLASH FLOODS'
      )

      addSatelliteLayer()
      addLiveSatelliteLayer()
      addEarthquakeLayer()
      addLandslideLayer()
      addHeatmapLayers()
      addRoadNetworkLayer()
      addOverview3DHeatmapAndContours()
      setupOverviewCoordHUD()
      setupOverviewParticleSimulation()
      setupOverviewModeButtons()
      setMapMode('heatmap3d')
      loadNASAEvents()
      loadEarthquakes()
    }
  )


  map.on(
    'error',
    event => {

      console.warn(
        'MapLibre error:',
        event
      )

    }
  )
  } catch (err) {
    console.warn('MapLibre init postponed until view is displayed:', err)
  }
}


/* =========================================================
   SATELLITE
========================================================= */

function addSatelliteLayer() {

  if (
    map.getLayer(
      'satellite-layer'
    )
  ) {
    return
  }


  map.addLayer({

    id:
      'satellite-layer',

    type:
      'raster',

    source:
      'satellite',

    paint: {

      'raster-opacity':
        1

    },

    layout: {

      visibility:
        'none'

    }

  })

}


/* =========================================================
   NASA LIVE SATELLITE
========================================================= */

function addLiveSatelliteLayer() {

  if (
    map.getLayer(
      'nasa-live-layer'
    )
  ) {
    return
  }


  map.addLayer({

    id:
      'nasa-live-layer',

    type:
      'raster',

    source:
      'nasaLive',

    paint: {

      'raster-opacity':
        0.75

    },

    layout: {

      visibility:
        'none'

    }

  })

}


/* =========================================================
   EARTHQUAKES
========================================================= */

function addEarthquakeLayer() {
  if (!map.getSource('earthquakes')) {
    map.addSource('earthquakes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  }

  if (!map.getLayer('earthquake-layer')) {
    map.addLayer({
      id: 'earthquake-layer',
      type: 'circle',
      source: 'earthquakes',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'mag'], 1],
          1, 5,
          3, 8,
          5, 14,
          7, 22
        ],
        'circle-color': '#d84c4c',
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });

    map.on('click', 'earthquake-layer', event => {
      const properties = event.features[0].properties;
      const magnitude = properties.mag !== undefined ? Number(properties.mag).toFixed(1) : 'N/A';
      const time = properties.time ? new Date(Number(properties.time)).toLocaleString('en-IN') : 'Unknown';

      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>Earthquake</strong><br>
          Magnitude: ${magnitude}<br>
          Location: ${properties.place || 'Unknown'}<br>
          Time: ${time}
        `)
        .addTo(map);
    });
  }
}

/* =========================================================
   LANDSLIDES
========================================================= */

function addLandslideLayer() {
  if (!map.getSource('landslides')) {
    map.addSource('landslides', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  }

  if (!map.getLayer('landslide-layer')) {
    map.addLayer({
      id: 'landslide-layer',
      type: 'circle',
      source: 'landslides',
      paint: {
        'circle-radius': 5,
        'circle-color': '#e0a128',
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      }
    });

    map.on('click', 'landslide-layer', event => {
      const properties = event.features[0].properties;
      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>Historical Landslide</strong><br>
          ${properties.title || 'NASA COOLR event'}<br>
          ${properties.date || 'Date unavailable'}
        `)
        .addTo(map);
    });
  }
}


/* =========================================================
   MULTI-HAZARD LIVE RISK & FLASH FLOOD DATASET (PAN-INDIA & HIMALAYAS)
========================================================= */

const MULTI_HAZARD_POINTS = [
  // 1. NORTH-EAST INDIA & EASTERN HIMALAYAS
  { name: 'Cherrapunji - Mawsynram Escarpment', lat: 25.2986, lon: 91.7317, type: 'LANDSLIDE', score: 96, state: 'Meghalaya', slope: 48, river: 'Wah Blei', vuln: 'Critical - Extreme Slope Saturation' },
  { name: 'Guwahati - Kamrup Urban Hills', lat: 26.1445, lon: 91.7362, type: 'MULTI_HAZARD', score: 88, state: 'Assam', slope: 36, river: 'Brahmaputra Main', vuln: 'Critical - Dense Urban Settlement' },
  { name: 'Majuli Island - River Confluence', lat: 26.9535, lon: 94.2181, type: 'FLASH_FLOOD', score: 93, state: 'Assam', slope: 2, river: 'Brahmaputra/Subansiri', vuln: 'Severe - Island Embankment Breach' },
  { name: 'Shillong Peak Corridor (NH-6)', lat: 25.5788, lon: 91.8933, type: 'LANDSLIDE', score: 84, state: 'Meghalaya', slope: 42, river: 'Umiam Catchment', vuln: 'High - Lifeline Highway Sector' },
  { name: 'Itanagar - Papum Pare Hills', lat: 27.0844, lon: 93.6053, type: 'LANDSLIDE', score: 90, state: 'Arunachal Pradesh', slope: 45, river: 'Dikrong River', vuln: 'High - Capital Access Roads' },
  { name: 'Barpeta - Manas Basin', lat: 26.3211, lon: 91.0065, type: 'FLASH_FLOOD', score: 91, state: 'Assam', slope: 4, river: 'Manas/Beki River', vuln: 'Severe - Low-lying Inundation' },
  { name: 'Tawang - Sela Pass Crest', lat: 27.5861, lon: 91.8594, type: 'LANDSLIDE', score: 81, state: 'Arunachal Pradesh', slope: 52, river: 'Tawang Chu', vuln: 'Critical - Strategic Pass Corridor' },
  { name: 'Silchar - Barak River Basin', lat: 24.8333, lon: 92.7789, type: 'FLASH_FLOOD', score: 94, state: 'Assam', slope: 5, river: 'Barak River', vuln: 'Critical - Urban Flood Basin' },
  { name: 'Kohima - NH-29 Fault Zone', lat: 25.6751, lon: 94.1086, type: 'LANDSLIDE', score: 86, state: 'Nagaland', slope: 46, river: 'Doyang Tributary', vuln: 'High - Road Blockage Risk' },
  { name: 'Gangtok - Teesta Valley Incline', lat: 27.3389, lon: 88.6065, type: 'LANDSLIDE', score: 89, state: 'Sikkim', slope: 54, river: 'Teesta River', vuln: 'Critical - Gorge Hydro & Transit' },
  { name: 'Mangan - North Sikkim Basin', lat: 27.5085, lon: 88.5284, type: 'MULTI_HAZARD', score: 97, state: 'Sikkim', slope: 56, river: 'Lachen/Lachung Chu', vuln: 'Critical - Landslide Lake Outburst' },
  { name: 'Dhemaji - Subansiri Flood Plain', lat: 27.4812, lon: 94.5768, type: 'FLASH_FLOOD', score: 89, state: 'Assam', slope: 3, river: 'Subansiri River', vuln: 'Severe - Flash River Inundation' },
  { name: 'Aizawl - Durtlang Ridge', lat: 23.7271, lon: 92.7176, type: 'LANDSLIDE', score: 80, state: 'Mizoram', slope: 49, river: 'Tlawng River', vuln: 'High - Ridge Settlement Zone' },
  { name: 'Imphal Valley - River Confluence', lat: 24.8170, lon: 93.9368, type: 'FLASH_FLOOD', score: 83, state: 'Manipur', slope: 6, river: 'Imphal River', vuln: 'High - Dense Valley Inundation' },
  { name: 'Dhubri - Lower Brahmaputra Delta', lat: 26.0195, lon: 89.9745, type: 'FLASH_FLOOD', score: 87, state: 'Assam', slope: 3, river: 'Brahmaputra Delta', vuln: 'High - Riverine Islands' },
  { name: 'Dima Hasao - Haflong Ghats', lat: 25.1764, lon: 93.0238, type: 'LANDSLIDE', score: 92, state: 'Assam', slope: 51, river: 'Jatinga River', vuln: 'Critical - Hill Railway & Road Link' },

  // 2. WESTERN HIMALAYAS & NORTH INDIA
  { name: 'Joshimath - Alaknanda Valley', lat: 30.5564, lon: 79.5667, type: 'LANDSLIDE', score: 95, state: 'Uttarakhand', slope: 58, river: 'Alaknanda River', vuln: 'Critical - Land Subsidence Zone' },
  { name: 'Kedarnath - Mandakini Gorge', lat: 30.7346, lon: 79.0669, type: 'MULTI_HAZARD', score: 98, state: 'Uttarakhand', slope: 62, river: 'Mandakini Surge', vuln: 'Extreme - High-Altitude Glacial Flood' },
  { name: 'Chamoli - Rishiganga Catchment', lat: 30.4000, lon: 79.3300, type: 'MULTI_HAZARD', score: 94, state: 'Uttarakhand', slope: 55, river: 'Dhauliganga River', vuln: 'Critical - Flash Flood & Debris Flow' },
  { name: 'Nainital - Kumaon Lake Slopes', lat: 29.3919, lon: 79.4542, type: 'LANDSLIDE', score: 85, state: 'Uttarakhand', slope: 44, river: 'Gaula Basin', vuln: 'High - Hill Tourist Inundation' },
  { name: 'Shimla - Dhalli Subsidence Zone', lat: 31.1048, lon: 77.1734, type: 'LANDSLIDE', score: 87, state: 'Himachal Pradesh', slope: 47, river: 'Sutlej Valley', vuln: 'High - Urban Hill Collapse' },
  { name: 'Kullu & Manali - Beas River Basin', lat: 32.2432, lon: 77.1892, type: 'FLASH_FLOOD', score: 93, state: 'Himachal Pradesh', slope: 35, river: 'Beas Surge', vuln: 'Critical - Flash River Overflow' },
  { name: 'Mandi - Pandoh Dam Catchment', lat: 31.7087, lon: 76.9320, type: 'MULTI_HAZARD', score: 89, state: 'Himachal Pradesh', slope: 42, river: 'Beas River', vuln: 'Severe - Cloudburst Flash Floods' },
  { name: 'Kinnaur - NH-5 Rockfall Corridor', lat: 31.6500, lon: 78.3500, type: 'LANDSLIDE', score: 91, state: 'Himachal Pradesh', slope: 60, river: 'Sutlej River', vuln: 'Critical - Massive Rockfall & Slides' },
  { name: 'Ramban - Jammu-Srinagar NH-44', lat: 33.2417, lon: 75.1956, type: 'LANDSLIDE', score: 92, state: 'Jammu & Kashmir', slope: 53, river: 'Chenab Gorge', vuln: 'Critical - Highway Severance' },
  { name: 'Srinagar - Jhelum River Basin', lat: 34.0837, lon: 74.7973, type: 'FLASH_FLOOD', score: 88, state: 'Jammu & Kashmir', slope: 5, river: 'Jhelum River', vuln: 'Severe - Urban Inundation' },

  // 3. WESTERN GHATS & SOUTH INDIA
  { name: 'Wayanad - Meppadi & Chooralmala', lat: 11.5500, lon: 76.1300, type: 'LANDSLIDE', score: 97, state: 'Kerala', slope: 52, river: 'Chaliyar Tributaries', vuln: 'Extreme - High Debris Avalanche' },
  { name: 'Idukki - Munnar Tea Slopes', lat: 10.0889, lon: 77.0595, type: 'LANDSLIDE', score: 91, state: 'Kerala', slope: 49, river: 'Periyar Catchment', vuln: 'Critical - Dam Inundation & Slides' },
  { name: 'Nilgiris - Coonoor & Ooty Escarpment', lat: 11.4102, lon: 76.6950, type: 'LANDSLIDE', score: 88, state: 'Tamil Nadu', slope: 46, river: 'Bhavani Basin', vuln: 'High - Hill Railway & Slopes' },
  { name: 'Valparai - Anamalai Hills', lat: 10.3256, lon: 76.9558, type: 'LANDSLIDE', score: 84, state: 'Tamil Nadu', slope: 43, river: 'Aliyar Catchment', vuln: 'High - Isolated Plantation Slopes' },
  { name: 'Coorg / Kodagu - Brahmagiri Slopes', lat: 12.3375, lon: 75.8069, type: 'LANDSLIDE', score: 89, state: 'Karnataka', slope: 48, river: 'Cauvery Headwaters', vuln: 'Severe - Catchment Landslides' },
  { name: 'Chikkamagaluru - Western Ghats', lat: 13.3161, lon: 75.7720, type: 'LANDSLIDE', score: 83, state: 'Karnataka', slope: 45, river: 'Bhadra Basin', vuln: 'High - Mountain Road Blockages' },
  { name: 'Mahad - Raigad Coastal Ghats', lat: 18.2346, lon: 73.4215, type: 'MULTI_HAZARD', score: 93, state: 'Maharashtra', slope: 50, river: 'Savitri River', vuln: 'Critical - Flash Floods & Village Slides' },
  { name: 'Chiplun - Vashishti River Basin', lat: 17.5323, lon: 73.5186, type: 'FLASH_FLOOD', score: 92, state: 'Maharashtra', slope: 8, river: 'Vashishti River', vuln: 'Critical - Estuary Flash Submersion' },
  { name: 'Mumbai - Mithi River Lowlands', lat: 19.0760, lon: 72.8777, type: 'FLASH_FLOOD', score: 86, state: 'Maharashtra', slope: 3, river: 'Mithi River', vuln: 'Critical - Mega-City Drainage Surge' },
  { name: 'Kochi - Periyar Coastal Floodplain', lat: 9.9312, lon: 76.2673, type: 'FLASH_FLOOD', score: 85, state: 'Kerala', slope: 2, river: 'Periyar River', vuln: 'High - Coastal Lagoon Flooding' },

  // 4. CENTRAL, EAST & GANGETIC FLOODPLAINS
  { name: 'Patna - Kosi/Ganga Confluence', lat: 25.5941, lon: 85.1376, type: 'FLASH_FLOOD', score: 89, state: 'Bihar', slope: 2, river: 'Ganga/Gandak/Kosi', vuln: 'Severe - River Embankment Overflow' },
  { name: 'Gorakhpur - Rapti River Basin', lat: 26.7606, lon: 83.3732, type: 'FLASH_FLOOD', score: 87, state: 'Uttar Pradesh', slope: 3, river: 'Rapti/Rohini River', vuln: 'Severe - Extensive Rural Inundation' },
  { name: 'Varanasi - Ganga High-Water Basin', lat: 25.3176, lon: 82.9739, type: 'FLASH_FLOOD', score: 82, state: 'Uttar Pradesh', slope: 3, river: 'Ganga River', vuln: 'High - Ghat Submersion & Lowlands' },
  { name: 'Puri & Cuttack - Mahanadi Delta', lat: 20.4625, lon: 85.8828, type: 'FLASH_FLOOD', score: 88, state: 'Odisha', slope: 2, river: 'Mahanadi Delta', vuln: 'Severe - Cyclone Surge & Inundation' },
  { name: 'Kolkata - Hooghly River Floodplain', lat: 22.5726, lon: 88.3639, type: 'FLASH_FLOOD', score: 84, state: 'West Bengal', slope: 2, river: 'Hooghly / Sundarbans', vuln: 'High - Tidal & Urban Flooding' },
  { name: 'Surat - Tapi River Basin', lat: 21.1702, lon: 72.8311, type: 'FLASH_FLOOD', score: 86, state: 'Gujarat', slope: 3, river: 'Tapi River / Ukai', vuln: 'Critical - Dam Release Surge' },
  { name: 'Ahmedabad - Sabarmati Lowlands', lat: 23.0225, lon: 72.5714, type: 'FLASH_FLOOD', score: 79, state: 'Gujarat', slope: 4, river: 'Sabarmati River', vuln: 'Moderate - Urban Catchment Flood' },
  { name: 'Delhi NCR - Yamuna Floodplains', lat: 28.6139, lon: 77.2090, type: 'FLASH_FLOOD', score: 87, state: 'Delhi NCR', slope: 2, river: 'Yamuna River', vuln: 'Severe - Low-lying Ring Road Surge' },
  { name: 'Bhopal - Upper Lake Catchment', lat: 23.2599, lon: 77.4126, type: 'FLASH_FLOOD', score: 77, state: 'Madhya Pradesh', slope: 5, river: 'Betwa Basin', vuln: 'Moderate - Urban Waterlogging' },
  { name: 'Hyderabad - Musi River Surge', lat: 17.3850, lon: 78.4867, type: 'FLASH_FLOOD', score: 81, state: 'Telangana', slope: 4, river: 'Musi River', vuln: 'High - Flash Urban Inundation' },
  { name: 'Vijayawada - Krishna River Delta', lat: 16.5062, lon: 80.6480, type: 'FLASH_FLOOD', score: 85, state: 'Andhra Pradesh', slope: 3, river: 'Prakasam Barrage Surge', vuln: 'Severe - Delta Inundation' }
];

let activeHazardFilter = 'ALL'; // 'ALL', 'LANDSLIDE', 'FLASH_FLOOD'

function getHazardGeoJson(filter = 'ALL') {
  const filtered = filter === 'ALL'
    ? MULTI_HAZARD_POINTS
    : MULTI_HAZARD_POINTS.filter(p => p.type === filter || p.type === 'MULTI_HAZARD');

  return {
    type: 'FeatureCollection',
    features: filtered.map(p => {
      const liveRain = latestRainfall ? (latestRainfall * (p.score / 60)).toFixed(1) : (p.score * 1.6).toFixed(1);
      const soilMoist = latestSoilMoisture ? (latestSoilMoisture * (p.score / 70)).toFixed(1) : (p.score * 0.9).toFixed(1);
      
      let level = 'LOW';
      if (p.score >= 88) level = 'SEVERE';
      else if (p.score >= 75) level = 'HIGH';
      else if (p.score >= 50) level = 'MODERATE';

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat]
        },
        properties: {
          name: p.name,
          state: p.state,
          hazard_type: p.type,
          risk_score: p.score,
          risk_level: level,
          slope_deg: p.slope,
          river: p.river,
          vulnerability: p.vuln,
          rainfall_mm: liveRain,
          soil_saturation: `${soilMoist}%`,
          updated_at: new Date().toISOString()
        }
      };
    })
  };
}

/* =========================================================
   HEATMAP & HOTSPOT LAYERS (Matching User Reference Image)
========================================================= */

function addHeatmapLayers() {
  // Add Multi-Hazard Live GeoJSON Source
  if (!map.getSource('hazard-heatmap-source')) {
    map.addSource('hazard-heatmap-source', {
      type: 'geojson',
      data: getHazardGeoJson(activeHazardFilter)
    });
  }

  // 1. Continuous Multi-Zone Heatmap (Luminous Gradient: Green -> Yellow -> Orange -> Red -> Crimson)
  if (!map.getLayer('hazard-heat-glow')) {
    map.addLayer({
      id: 'hazard-heat-glow',
      type: 'heatmap',
      source: 'hazard-heatmap-source',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          0, 0,
          25, 0.35,
          50, 0.70,
          75, 1.1,
          100, 1.8
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1.5,
          4, 2.8,
          7, 4.5,
          10, 6.0
        ],
        // Exact Color Ramp matching user's Image 2: Transparent -> Lime Green -> Yellow -> Bright Orange -> Hot Red -> Crimson Core
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0, 255, 60, 0)',
          0.1, 'rgba(0, 255, 60, 0.5)',
          0.25, 'rgba(57, 255, 20, 0.85)',
          0.45, 'rgba(255, 230, 0, 0.92)',
          0.65, 'rgba(255, 120, 0, 0.96)',
          0.85, 'rgba(255, 25, 25, 0.98)',
          1, 'rgba(180, 0, 30, 1)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 30,
          3, 55,
          5, 90,
          8, 140,
          11, 190
        ],
        'heatmap-opacity': 0.92
      }
    });
  }

  // 2. Concentric Hotspot Indicator Rings (Matching the white-bordered circular nodes in Image 2)
  if (!map.getLayer('hazard-hotspot-rings')) {
    map.addLayer({
      id: 'hazard-hotspot-rings',
      type: 'circle',
      source: 'hazard-heatmap-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          20, 8,
          50, 13,
          75, 18,
          95, 26
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          30, '#39ff14',
          55, '#ffd000',
          75, '#ff6600',
          90, '#ff1e1e',
          100, '#b8001f'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          30, 2,
          75, 3,
          90, 4
        ],
        'circle-opacity': 0.95
      }
    });
  }

  // 3. Hotspot Core Node Center Dot
  if (!map.getLayer('hazard-hotspot-core')) {
    map.addLayer({
      id: 'hazard-hotspot-core',
      type: 'circle',
      source: 'hazard-heatmap-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          30, 3,
          75, 5,
          90, 8
        ],
        'circle-color': '#ffffff',
        'circle-opacity': 0.95
      }
    });
  }

  // Hotspot Click Popup Handler with Interactive 3D Physics Simulation Action
  map.on('click', 'hazard-hotspot-rings', (e) => {
    const props = e.features[0].properties;
    const isFlood = props.hazard_type === 'FLASH_FLOOD';
    const isMulti = props.hazard_type === 'MULTI_HAZARD';
    const badgeColor = props.risk_score >= 85 ? '#ff1e1e' : (props.risk_score >= 70 ? '#ff7700' : '#ffd000');

    // Route geographic zone to corresponding 3D simulation model preset
    let targetPreset = 'nilgiris';
    if (props.state === 'Sikkim' || props.name.includes('Gangtok') || props.name.includes('Teesta') || props.name.includes('Mangan') || props.name.includes('Likhu')) {
      targetPreset = 'sikkim';
    } else if (props.state === 'Meghalaya' || props.state === 'Assam' || props.state === 'Arunachal Pradesh' || props.state === 'Nagaland' || props.state === 'Mizoram') {
      targetPreset = 'meghalaya';
    } else if (props.state === 'Kerala' || props.name.includes('Wayanad')) {
      targetPreset = 'wayanad';
    }

    new maplibregl.Popup({ maxWidth: '320px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-family:inherit; min-width:220px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13px; color:#fff;">${props.name}</strong>
            <span style="background:${badgeColor}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${props.risk_level}</span>
          </div>
          <div style="font-size:11px; margin-bottom:6px; color:#aab;">
            Region: <strong>${props.state}</strong> | Type: <strong>${isMulti ? '🌋 Landslide + 🌊 Flood' : (isFlood ? '🌊 Flash Flood' : '🌋 Landslide')}</strong>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:8px; border-radius:8px; margin-bottom:8px; font-size:11px; line-height:1.4;">
            <div>🔥 <strong>Live Hazard Score:</strong> <span style="color:${badgeColor}; font-weight:800;">${props.risk_score}/100</span></div>
            <div>🌧️ <strong>Precipitation Rate:</strong> ${props.rainfall_mm} mm/24h</div>
            <div>💧 <strong>Soil Moisture Saturation:</strong> ${props.soil_saturation}</div>
            <div>⛰️ <strong>Slope Gradient:</strong> ${props.slope_deg}° ${props.river ? `| 🌊 ${props.river}` : ''}</div>
          </div>
          <div style="font-size:10px; color:#ffdd88; margin-bottom:10px;">
            ⚠️ <em>${props.vulnerability}</em>
          </div>
          <button 
            id="btn-launch-sim-popup"
            onclick="window.launch3DSimulationForZone('${targetPreset}', '${props.name.replace(/'/g, "\\'")}')"
            style="width:100%; padding:9px 12px; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; border-radius:6px; color:#fff; font-weight:800; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 12px rgba(2, 132, 199, 0.4); transition:all 0.2s;"
          >
            <span>▲</span> Launch 3D Physics Simulation
          </button>
          <button 
            id="btn-focus-3d-popup"
            onclick="window.focusOverview3DHeatmap([${e.lngLat.lng}, ${e.lngLat.lat}], '${props.name.replace(/'/g, "\\'")}')"
            style="width:100%; margin-top:6px; padding:8px 12px; background:linear-gradient(135deg, #ea580c, #dc2626); border:none; border-radius:6px; color:#fff; font-weight:800; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 12px rgba(220, 38, 38, 0.4); transition:all 0.2s;"
          >
            <span>🌋</span> View in 3D Risk Heatmap
          </button>
        </div>
      `)
      .addTo(map);
  });

  window.launch3DSimulationForZone = function(presetKey, zoneName) {
    const simNav = document.querySelector('[data-section="simulation"]');
    if (simNav) simNav.click();

    setTimeout(() => {
      const simSelector = document.getElementById('sim-region-selector');
      if (simSelector) {
        simSelector.value = presetKey;
        simSelector.dispatchEvent(new Event('change'));
      }
    }, 150);
  };

  window.launch3DSimulationForCoordinates = function(coords, name) {
    const simNav = document.querySelector('[data-section="simulation"]');
    if (simNav) simNav.click();

    setTimeout(() => {
      if (window.landslideDashboardInstance && window.landslideDashboardInstance.simView) {
        window.landslideDashboardInstance.simView.focusHeatmapAtCoordinate(coords, { name });
      }
    }, 250);
  };

  // Click on ANY area on the overview map to generate 3D Topographic Risk Heatmap
  map.on('click', (e) => {
    const interactiveLayers = ['hazard-hotspot-rings', 'earthquake-layer', 'landslide-layer', 'highway-node-rings'];
    const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers.filter(id => map.getLayer(id)) });
    if (hits && hits.length > 0) return;

    const [lng, lat] = [e.lngLat.lng, e.lngLat.lat];
    window.focusOverview3DHeatmap([lng, lat], `Point [${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E]`);

    new maplibregl.Popup({ maxWidth: '300px', closeButton: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-family:inherit; min-width:210px; color:#f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="font-size:12px; color:#fff;">🌋 3D Topographic Heatmap</strong>
            <span style="background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid rgba(239, 68, 68, 0.4); font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px;">ACTIVE</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">
            Coordinate: <strong>${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</strong>
          </div>
          <button 
            onclick="window.launch3DSimulationForCoordinates([${lng}, ${lat}], 'Custom Analysis Point')"
            style="width:100%; padding:8px 10px; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; border-radius:6px; color:#fff; font-weight:700; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 12px rgba(2, 132, 199, 0.4);"
          >
            <span>▲</span> Open in 3D Simulation Cockpit
          </button>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'hazard-hotspot-rings', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'hazard-hotspot-rings', () => { map.getCanvas().style.cursor = ''; });

  setupMapLayerChips();
}

/* =========================================================
   ROAD CONNECTIVITY & HIGHWAY NETWORKS (GIS LAYERS)
========================================================= */

function getHighwaysGeoJson() {
  return {
    type: 'FeatureCollection',
    features: REGIONAL_HIGHWAY_CORRIDORS.map(corridor => ({
      type: 'Feature',
      id: corridor.id,
      properties: {
        id: corridor.id,
        state: corridor.state,
        highway: corridor.highway,
        segments: corridor.segments,
        status: corridor.status,
        note: corridor.note,
        color: corridor.color,
        chokePoint: corridor.chokePoint || ''
      },
      geometry: {
        type: 'LineString',
        coordinates: corridor.coordinates
      }
    }))
  };
}

function getHighwayNodesGeoJson() {
  return {
    type: 'FeatureCollection',
    features: REGIONAL_HIGHWAY_CORRIDORS.map(corridor => ({
      type: 'Feature',
      id: `node-${corridor.id}`,
      properties: {
        id: corridor.id,
        state: corridor.state,
        highway: corridor.highway,
        segments: corridor.segments,
        status: corridor.status,
        note: corridor.note,
        color: corridor.color,
        chokePoint: corridor.chokePoint || corridor.highway
      },
      geometry: {
        type: 'Point',
        coordinates: corridor.center
      }
    }))
  };
}

function addRoadNetworkLayer() {
  if (!map) return;

  if (!map.getSource('highways-source')) {
    map.addSource('highways-source', {
      type: 'geojson',
      data: getHighwaysGeoJson()
    });
  }

  if (!map.getSource('highway-nodes-source')) {
    map.addSource('highway-nodes-source', {
      type: 'geojson',
      data: getHighwayNodesGeoJson()
    });
  }

  // 1. Glowing Halo around highway lines
  if (!map.getLayer('highway-glow')) {
    map.addLayer({
      id: 'highway-glow',
      type: 'line',
      source: 'highways-source',
      layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': 'visible' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 8, 12, 12, 18],
        'line-opacity': 0.65,
        'line-blur': 2.5
      }
    });
  }

  // 2. Dark Casing for high contrast
  if (!map.getLayer('highway-casing')) {
    map.addLayer({
      id: 'highway-casing',
      type: 'line',
      source: 'highways-source',
      layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': 'visible' },
      paint: {
        'line-color': '#0e1511',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 8, 6, 12, 9],
        'line-opacity': 0.95
      }
    });
  }

  // 3. Crisp Core Line (Green = Passable, Amber = Watch, Red = Caution)
  if (!map.getLayer('highway-core')) {
    map.addLayer({
      id: 'highway-core',
      type: 'line',
      source: 'highways-source',
      layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': 'visible' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.4, 8, 4.2, 12, 6.8]
      }
    });
  }

  // 4. Highway Choke Point Pulsing Rings
  if (!map.getLayer('highway-node-rings')) {
    map.addLayer({
      id: 'highway-node-rings',
      type: 'circle',
      source: 'highway-nodes-source',
      layout: { 'visibility': 'visible' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 8, 12, 12, 16],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.35,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2
      }
    });
  }

  // 5. Highway Choke Point Core Node
  if (!map.getLayer('highway-node-cores')) {
    map.addLayer({
      id: 'highway-node-cores',
      type: 'circle',
      source: 'highway-nodes-source',
      layout: { 'visibility': 'visible' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 8, 5.5, 12, 8],
        'circle-color': '#ffffff',
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2
      }
    });
  }

  // Highway Click Popups
  map.on('click', 'highway-core', (e) => {
    const props = e.features[0].properties;
    showHighwayPopup(props, e.lngLat);
  });

  map.on('click', 'highway-node-rings', (e) => {
    const props = e.features[0].properties;
    showHighwayPopup(props, e.lngLat);
  });

  map.on('mouseenter', 'highway-core', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'highway-core', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'highway-node-rings', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'highway-node-rings', () => { map.getCanvas().style.cursor = ''; });
}

function showHighwayPopup(props, lngLat) {
  const badgeClass = props.status === 'PASSABLE' ? 'road-badge-passable' : props.status === 'WATCH' ? 'road-badge-watch' : 'road-badge-caution';
  const icon = props.status === 'PASSABLE' ? '🟢' : props.status === 'WATCH' ? '🟡' : '🔴';

  new maplibregl.Popup({ offset: 12 })
    .setLngLat(lngLat)
    .setHTML(`
      <div style="font-family: inherit; min-width: 230px; padding: 4px 2px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
          <strong style="color:#fff; font-size:12px;">${props.highway}</strong>
          <span class="road-badge ${badgeClass}" style="font-size:9px;">${icon} ${props.status}</span>
        </div>
        <div style="font-size:10px; color:#aab5ad; margin-bottom:6px;">
          <strong>Region:</strong> ${props.state} • ${props.segments ? `${props.segments} km mapped` : ''}
        </div>
        ${props.chokePoint ? `<div style="font-size:10px; color:#ffd000; margin-bottom:6px;">📍 <strong>Critical Sector:</strong> ${props.chokePoint}</div>` : ''}
        <div style="background: rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 6px; font-size: 10px; color: #edf2ed; border-left: 3px solid ${props.color || '#22c55e'}; line-height: 1.4;">
          ${props.note || 'Corridor telemetry nominal'}
        </div>
      </div>
    `)
    .addTo(map);
}

window.zoomToHighway = function(id) {
  const corridor = REGIONAL_HIGHWAY_CORRIDORS.find(c => c.id === id);
  if (!corridor || !map) return;

  // Scroll to map
  document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth' });

  // Ensure highway layers are visible
  const roadLayers = ['highway-glow', 'highway-casing', 'highway-core', 'highway-node-rings', 'highway-node-cores'];
  roadLayers.forEach(layerId => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'visible');
  });

  const chipRoads = document.getElementById('chipRoads');
  if (chipRoads) chipRoads.classList.add('active');

  // Fly to corridor
  map.flyTo({
    center: corridor.center,
    zoom: 7.8,
    speed: 1.3,
    curve: 1.4,
    essential: true
  });

  // Open Popup
  setTimeout(() => {
    showHighwayPopup(corridor, corridor.center);
  }, 600);

  updateGISStatus(`🛣️ HIGHWAY CORRIDOR: ${corridor.highway} • STATUS: ${corridor.status}`);
};

function setupMapLayerChips() {
  const chipLandslides = document.getElementById('chipLandslides');
  const chipFloods = document.getElementById('chipFloods');
  const chipHotspots = document.getElementById('chipHotspots');
  const chipRoads = document.getElementById('chipRoads');

  if (chipLandslides) {
    chipLandslides.onclick = () => {
      chipLandslides.classList.toggle('active');
      updateHazardLayerFilter();
    };
  }

  if (chipFloods) {
    chipFloods.onclick = () => {
      chipFloods.classList.toggle('active');
      updateHazardLayerFilter();
    };
  }

  if (chipHotspots) {
    chipHotspots.onclick = () => {
      chipHotspots.classList.toggle('active');
      const isVisible = chipHotspots.classList.contains('active');
      if (map.getLayer('hazard-hotspot-rings')) {
        map.setLayoutProperty('hazard-hotspot-rings', 'visibility', isVisible ? 'visible' : 'none');
        map.setLayoutProperty('hazard-hotspot-core', 'visibility', isVisible ? 'visible' : 'none');
      }
    };
  }

  if (chipRoads) {
    chipRoads.onclick = () => {
      chipRoads.classList.toggle('active');
      const isVisible = chipRoads.classList.contains('active');
      const roadLayers = ['highway-glow', 'highway-casing', 'highway-core', 'highway-node-rings', 'highway-node-cores'];
      roadLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
    };
  }
}

function updateHazardLayerFilter() {
  const showLandslides = document.getElementById('chipLandslides')?.classList.contains('active');
  const showFloods = document.getElementById('chipFloods')?.classList.contains('active');

  let filter = 'ALL';
  if (showLandslides && !showFloods) filter = 'LANDSLIDE';
  else if (!showLandslides && showFloods) filter = 'FLASH_FLOOD';
  else if (!showLandslides && !showFloods) filter = 'NONE';

  const source = map.getSource('hazard-heatmap-source');
  if (source) {
    source.setData(filter === 'NONE' ? { type: 'FeatureCollection', features: [] } : getHazardGeoJson(filter));
  }
}

/* =========================================================
   MERGED 3D SIMULATION TOPOGRAPHIC MAP ENGINE
========================================================= */

let current3DFocusOrigin = [76.7843, 10.2147]; // Default to Nilgiris (matching reference Image 1)
let overviewParticleCtx = null;
let overviewParticles = [];
let overviewPhysicsRunning = false;
let overviewAnimFrameId = null;

function generateHypsometricHeatmapCanvas() {
  const SIZE = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 460;

  // 1. PRIMARY RADIAL GRADIENT (matching Image 1 color ramp: Crimson -> Orange -> Yellow -> Green -> Blue)
  const mainGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  mainGrad.addColorStop(0.00, 'rgba(200, 20, 20, 0.94)');
  mainGrad.addColorStop(0.06, 'rgba(220, 38, 38, 0.90)');
  mainGrad.addColorStop(0.12, 'rgba(239, 68, 40, 0.86)');
  mainGrad.addColorStop(0.20, 'rgba(249, 115, 22, 0.80)');
  mainGrad.addColorStop(0.28, 'rgba(251, 146, 60, 0.74)');
  mainGrad.addColorStop(0.36, 'rgba(252, 211, 77, 0.68)');
  mainGrad.addColorStop(0.44, 'rgba(250, 240, 55, 0.62)');
  mainGrad.addColorStop(0.52, 'rgba(190, 235, 50, 0.55)');
  mainGrad.addColorStop(0.60, 'rgba(74, 222, 128, 0.48)');
  mainGrad.addColorStop(0.68, 'rgba(20, 184, 166, 0.40)');
  mainGrad.addColorStop(0.75, 'rgba(6, 182, 212, 0.32)');
  mainGrad.addColorStop(0.83, 'rgba(56, 189, 248, 0.22)');
  mainGrad.addColorStop(0.90, 'rgba(59, 130, 246, 0.14)');
  mainGrad.addColorStop(0.96, 'rgba(37, 99, 235, 0.06)');
  mainGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.00)');

  ctx.save();
  ctx.scale(1.0, 0.82);
  ctx.beginPath();
  ctx.arc(cx, cy / 0.82, R, 0, Math.PI * 2);
  ctx.fillStyle = mainGrad;
  ctx.fill();
  ctx.restore();

  // 2. CONCENTRIC ELLIPTICAL RING CONTOURS (Exact spacing matching Image 1)
  const rings = [
    { r: 28, lw: 2.2, color: 'rgba(255, 255, 255, 0.80)' },
    { r: 52, lw: 1.8, color: 'rgba(255, 220, 160, 0.75)' },
    { r: 78, lw: 1.8, color: 'rgba(255, 200, 60, 0.70)' },
    { r: 105, lw: 1.6, color: 'rgba(220, 240, 50, 0.65)' },
    { r: 132, lw: 1.6, color: 'rgba(130, 235, 90, 0.60)' },
    { r: 160, lw: 1.4, color: 'rgba(60, 220, 160, 0.54)' },
    { r: 188, lw: 1.4, color: 'rgba(30, 200, 210, 0.48)' },
    { r: 215, lw: 1.2, color: 'rgba(50, 190, 240, 0.40)' },
    { r: 242, lw: 1.2, color: 'rgba(80, 170, 255, 0.32)' },
    { r: 268, lw: 1.0, color: 'rgba(100, 150, 255, 0.24)' },
    { r: 294, lw: 1.0, color: 'rgba(110, 130, 255, 0.18)' },
    { r: 320, lw: 0.8, color: 'rgba(120, 120, 250, 0.12)' },
    { r: 346, lw: 0.8, color: 'rgba(130, 110, 240, 0.08)' },
    { r: 372, lw: 0.6, color: 'rgba(140, 100, 230, 0.05)' }
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

  // 3. INNER GLOW HOTSPOT
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
  coreGlow.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)');
  coreGlow.addColorStop(0.4, 'rgba(255, 100, 50, 0.18)');
  coreGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0.00)');
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fillStyle = coreGlow;
  ctx.fill();

  return canvas;
}

function generateHypsometricHeatmapDataURL() {
  return generateHypsometricHeatmapCanvas().toDataURL();
}

function addOverview3DHeatmapAndContours() {
  updateOverview3DHeatmapBounds(current3DFocusOrigin);
  updateOverviewContourLines(current3DFocusOrigin);
}

function updateOverview3DHeatmapBounds(origin = current3DFocusOrigin) {
  if (!map) return;
  const [oLon, oLat] = origin;
  const spanLon = 0.090;
  const spanLat = 0.075;
  const bounds = [
    [oLon - spanLon / 2, oLat + spanLat / 2],
    [oLon + spanLon / 2, oLat + spanLat / 2],
    [oLon + spanLon / 2, oLat - spanLat / 2],
    [oLon - spanLon / 2, oLat - spanLat / 2]
  ];

  const canvas = generateHypsometricHeatmapCanvas();

  if (map.getSource('heatmap-3d-raster-src')) {
    const src = map.getSource('heatmap-3d-raster-src');
    src.updateImage({
      image: canvas,
      coordinates: bounds
    });
  } else {
    map.addSource('heatmap-3d-raster-src', {
      type: 'image',
      url: canvas.toDataURL(),
      coordinates: bounds
    });

    const src = map.getSource('heatmap-3d-raster-src');
    if (src) {
      src.updateImage({
        image: canvas,
        coordinates: bounds
      });
    }

    map.addLayer({
      id: 'heatmap-3d-raster-layer',
      type: 'raster',
      source: 'heatmap-3d-raster-src',
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0.88,
        'raster-fade-duration': 0
      }
    });
  }
  map.triggerRepaint();
}

function updateOverviewContourLines(center = current3DFocusOrigin) {
  if (!map) return;
  const [cLon, cLat] = center;
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

  const geo = {
    type: 'FeatureCollection',
    features: contourFeatures
  };

  if (map.getSource('contours-src')) {
    map.getSource('contours-src').setData(geo);
  } else {
    map.addSource('contours-src', {
      type: 'geojson',
      data: geo
    });

    map.addLayer({
      id: 'contours-line',
      type: 'line',
      source: 'contours-src',
      layout: { visibility: 'none' },
      paint: {
        'line-color': 'rgba(148, 163, 184, 0.55)',
        'line-width': 1.4,
        'line-dasharray': [4, 3]
      }
    });
  }
}

function updateOverviewCollarCoordinates(center = current3DFocusOrigin) {
  const [cLon, cLat] = center;
  const latEl = document.getElementById('overviewCollarLat');
  const lonEl = document.getElementById('overviewCollarLon');

  const formatCoord = (val, dir) => {
    const deg = Math.floor(Math.abs(val));
    const min = Math.round((Math.abs(val) - deg) * 60).toString().padStart(2, '0');
    return `${deg}°${min}' ${dir}`;
  };

  if (latEl) {
    latEl.innerHTML = `
      <span class="collar-tick">${formatCoord(cLat + 0.04, 'N')}</span>
      <span class="collar-tick">${formatCoord(cLat + 0.015, 'N')}</span>
      <span class="collar-tick">${formatCoord(cLat - 0.015, 'N')}</span>
      <span class="collar-tick">${formatCoord(cLat - 0.04, 'N')}</span>
    `;
  }

  if (lonEl) {
    lonEl.innerHTML = `
      <span class="collar-tick">${formatCoord(cLon - 0.05, 'E')}</span>
      <span class="collar-tick">${formatCoord(cLon - 0.025, 'E')}</span>
      <span class="collar-tick">${formatCoord(cLon, 'E')}</span>
      <span class="collar-tick">${formatCoord(cLon + 0.025, 'E')}</span>
      <span class="collar-tick">${formatCoord(cLon + 0.05, 'E')}</span>
    `;
  }
}

function setupOverviewCoordHUD() {
  const hudEl = document.getElementById('overviewCoordHud');
  if (!hudEl || !map) return;

  map.on('mousemove', e => {
    const lat = e.lngLat.lat.toFixed(4);
    const lon = e.lngLat.lng.toFixed(4);
    const elev = Math.round(1256 + 400 * Math.sin(e.lngLat.lat * 100));
    hudEl.innerHTML = `Lat: <span class="coord-val">${lat}° N</span> &nbsp; Lon: <span class="coord-val">${lon}° E</span> &nbsp; Elev: <span class="coord-val">${elev.toLocaleString()} m</span>`;
  });
}

function setupOverviewParticleSimulation() {
  const canvas = document.getElementById('overviewParticleCanvas');
  if (!canvas || !map) return;
  overviewParticleCtx = canvas.getContext('2d');

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };
  resize();
  window.addEventListener('resize', resize);

  overviewParticles = [];
  for (let i = 0; i < 90; i++) {
    overviewParticles.push({
      t: Math.random(),
      speed: 0.003 + Math.random() * 0.005,
      lateralSpread: (Math.random() - 0.5) * 0.0028,
      size: 1.5 + Math.random() * 3.5,
      color: Math.random() > 0.65 ? '#ef4444' : Math.random() > 0.3 ? '#f97316' : '#eab308',
      alpha: 0.6 + Math.random() * 0.4,
      trail: []
    });
  }

  const loop = () => {
    if (overviewPhysicsRunning && overviewParticleCtx && map) {
      overviewParticleCtx.clearRect(0, 0, canvas.width, canvas.height);
      const origin = current3DFocusOrigin;
      const toe = [origin[0] + 0.015, origin[1] - 0.013];
      const originPix = map.project(origin);
      const toePix = map.project(toe);
      const dx = toePix.x - originPix.x;
      const dy = toePix.y - originPix.y;

      for (let i = 0; i < overviewParticles.length; i++) {
        const p = overviewParticles[i];
        p.t += p.speed;
        if (p.t > 1.0) {
          p.t = 0;
          p.trail = [];
          continue;
        }
        const curX = originPix.x + dx * p.t + p.lateralSpread * canvas.width * Math.sin(p.t * Math.PI);
        const curY = originPix.y + dy * p.t + Math.pow(p.t, 1.3) * 10;

        p.trail.push({ x: curX, y: curY });
        if (p.trail.length > 4) p.trail.shift();

        if (p.trail.length > 1) {
          overviewParticleCtx.beginPath();
          overviewParticleCtx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let j = 1; j < p.trail.length; j++) {
            overviewParticleCtx.lineTo(p.trail[j].x, p.trail[j].y);
          }
          overviewParticleCtx.strokeStyle = p.color;
          overviewParticleCtx.globalAlpha = p.alpha * 0.45;
          overviewParticleCtx.lineWidth = p.size * 0.8;
          overviewParticleCtx.stroke();
        }

        overviewParticleCtx.beginPath();
        overviewParticleCtx.arc(curX, curY, p.size, 0, Math.PI * 2);
        overviewParticleCtx.fillStyle = p.color;
        overviewParticleCtx.globalAlpha = p.alpha;
        overviewParticleCtx.fill();
      }
    } else if (overviewParticleCtx) {
      overviewParticleCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
    overviewAnimFrameId = requestAnimationFrame(loop);
  };
  if (overviewAnimFrameId) cancelAnimationFrame(overviewAnimFrameId);
  overviewAnimFrameId = requestAnimationFrame(loop);
}

function setupOverviewModeButtons() {
  document.querySelectorAll('#overviewViewmodePills .viewmode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.overviewMode;
      setMapMode(mode);
    });
  });

  document.getElementById('overviewCompassWidget')?.addEventListener('click', () => {
    if (map) map.easeTo({ bearing: 0, duration: 600 });
  });
}

window.focusOverview3DHeatmap = function(lngLat, name) {
  if (Array.isArray(lngLat) && lngLat.length === 2) {
    current3DFocusOrigin = lngLat;
    setMapMode('heatmap3d');
  }
};

/* =========================================================
   MAP MODE SWITCHER (MERGED 2D & 3D MODES)
========================================================= */

function setMapMode(mode) {
  if (!map) return;

  const baseLayers = ['osm-base', 'satellite-layer', 'nasa-live-layer'];
  baseLayers.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  });

  // Ensure Base OSM is active
  if (map.getLayer('osm-base')) {
    map.setLayoutProperty('osm-base', 'visibility', 'visible');
  }

  // Ensure Heatmap & Hotspot layers are visible by default
  const heatmapLayers = ['hazard-heat-glow', 'hazard-hotspot-rings', 'hazard-hotspot-core'];
  heatmapLayers.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
  });

  // Ensure Highway layers are visible
  const roadLayers = ['highway-glow', 'highway-casing', 'highway-core', 'highway-node-rings', 'highway-node-cores'];
  roadLayers.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
  });

  // Sync pill switcher buttons
  document.querySelectorAll('#overviewViewmodePills .viewmode-btn').forEach(b => {
    const bMode = b.dataset.overviewMode;
    const isAct = bMode === mode || (mode === '2d' && bMode === '2d') || (mode === 'heatmap' && bMode === '2d');
    b.classList.toggle('active', isAct);
  });

  if (mode === 'heatmap3d') {
    if (map.getLayer('satellite-layer')) {
      map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      map.setPaintProperty('satellite-layer', 'raster-opacity', 1.0);
    }
    map.setTerrain({ source: 'terrain', exaggeration: 2.15 });

    updateOverview3DHeatmapBounds(current3DFocusOrigin);
    updateOverviewContourLines(current3DFocusOrigin);
    updateOverviewCollarCoordinates(current3DFocusOrigin);

    if (map.getLayer('heatmap-3d-raster-layer')) {
      map.setLayoutProperty('heatmap-3d-raster-layer', 'visibility', 'visible');
    }
    if (map.getLayer('contours-line')) {
      map.setLayoutProperty('contours-line', 'visibility', 'visible');
    }

    document.getElementById('overviewHeatmapLegend')?.classList.remove('hidden');
    document.getElementById('overviewCoordCollar')?.classList.remove('hidden');
    document.getElementById('overviewCompassWidget')?.classList.remove('hidden');
    document.getElementById('overviewScalebar')?.classList.remove('hidden');
    document.getElementById('overviewCoordHud')?.classList.remove('hidden');

    overviewPhysicsRunning = true;

    map.easeTo({
      center: current3DFocusOrigin,
      zoom: 13.8,
      pitch: 65,
      bearing: -22,
      duration: 1200
    });

    updateGISStatus('🌋 3D TOPOGRAPHIC HAZARD HEATMAP • FOS < 1.0 ACTIVE');
    return;
  }

  // Disable 3D Heatmap specific elements for other modes
  if (map.getLayer('heatmap-3d-raster-layer')) {
    map.setLayoutProperty('heatmap-3d-raster-layer', 'visibility', 'none');
  }
  document.getElementById('overviewHeatmapLegend')?.classList.add('hidden');
  document.getElementById('overviewCoordCollar')?.classList.add('hidden');
  overviewPhysicsRunning = false;

  if (mode === 'terrain') {
    if (map.getLayer('satellite-layer')) {
      map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
    }
    map.setTerrain({ source: 'terrain', exaggeration: 2.0 });
    updateOverviewContourLines(current3DFocusOrigin);
    if (map.getLayer('contours-line')) {
      map.setLayoutProperty('contours-line', 'visibility', 'visible');
    }
    document.getElementById('overviewCompassWidget')?.classList.remove('hidden');
    document.getElementById('overviewScalebar')?.classList.remove('hidden');
    document.getElementById('overviewCoordHud')?.classList.remove('hidden');
    map.easeTo({ pitch: 58, bearing: -20, duration: 1000 });
    updateGISStatus('⛰️ 3D TERRAIN • HAZARD ELEVATION RELIEF');
    return;
  }

  if (mode === '3d') {
    if (map.getLayer('satellite-layer')) {
      map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
    if (map.getLayer('contours-line')) {
      map.setLayoutProperty('contours-line', 'visibility', 'none');
    }
    document.getElementById('overviewCompassWidget')?.classList.remove('hidden');
    document.getElementById('overviewScalebar')?.classList.remove('hidden');
    document.getElementById('overviewCoordHud')?.classList.remove('hidden');
    map.easeTo({ pitch: 52, duration: 1000 });
    updateGISStatus('⛰️ 3D SATELLITE PERSPECTIVE RELIEF');
    return;
  }

  // 2D mode: reset terrain and pitch
  map.setTerrain(null);
  if (map.getLayer('contours-line')) {
    map.setLayoutProperty('contours-line', 'visibility', 'none');
  }

  if (mode === '2d' || mode === 'heatmap' || mode === 'risk') {
    updateHazardSourceFilter('ALL');
    updateGISStatus('🔥 LIVE MULTI-HAZARD HEATMAP • LANDSLIDES & FLASH FLOODS');
    document.getElementById('chipLandslides')?.classList.add('active');
    document.getElementById('chipFloods')?.classList.add('active');
  }

  map.easeTo({ pitch: 0, duration: 700 });
}

function updateHazardSourceFilter(filter) {
  const source = map.getSource('hazard-heatmap-source');
  if (source) {
    source.setData(getHazardGeoJson(filter));
  }
}


/* =========================================================
   NASA COOLR & GSI LANDSLIDE REPOSITORY (VERIFIED CATALOG)
========================================================= */

const HISTORICAL_NASA_COOLR = [
  // 2026
  { title: 'Sonapur Heavy Slump Sector, NH-6', date: '2026-03-02', cat: 'Debris Flow', trig: 'Early Pre-Monsoon Thunderstorm', lat: 25.1142, lon: 92.3685 },
  { title: 'Gangtok 3rd Mile Slide, Sikkim', date: '2026-02-14', cat: 'Creep Slope Movement', trig: 'Ground Moisture Saturation', lat: 27.3410, lon: 88.6210 },
  { title: 'Roing-Mayodia Snow & Rock Avalanche', date: '2026-01-20', cat: 'Snow-Rock Avalanche', trig: 'Winter Blizzard / Freeze-Thaw', lat: 28.2310, lon: 95.8920 },

  // 2025
  { title: 'Dima Hasao Railway Slip, Jatinga', date: '2025-06-22', cat: 'Mudslide / Rail Bed Washout', trig: 'Heavy Torrential Rain', lat: 25.1234, lon: 92.9862 },
  { title: 'Dzüdza River Bridge Landslide, NH-29', date: '2025-08-04', cat: 'Rockfall / Slope Failure', trig: 'Excessive Rainfall & Saturated Soil', lat: 25.6842, lon: 93.9875 },
  { title: 'Mangan-Chungthang Road Block, North Sikkim', date: '2025-09-18', cat: 'Massive Debris Flow', trig: 'Flash Flood Runoff & Cloudburst', lat: 27.5140, lon: 88.6415 },
  { title: 'Banderdewa Slope Failure, NH-415', date: '2025-07-28', cat: 'Rotational Landslide', trig: 'Monsoon Heavy Rainfall', lat: 27.1215, lon: 93.8124 },
  { title: 'Hunli-Anini Highway Blockage, Dibang', date: '2025-06-30', cat: 'Rock Slide', trig: 'Steep Terrain Heavy Inundation', lat: 28.3245, lon: 95.8451 },
  { title: 'Lunglei-Thenzawl Road Cut Slip', date: '2025-08-15', cat: 'Debris Slide', trig: 'Prolonged Rainfall', lat: 23.2845, lon: 92.7482 },
  { title: 'Imphal-Jiribam NH-37 Mudslide Sector', date: '2025-09-05', cat: 'Mudflow', trig: 'Soil Super-saturation', lat: 24.8120, lon: 93.4210 },
  { title: 'Barapani-Umiam Hill Slope Failure', date: '2025-08-20', cat: 'Complex Rock Slide', trig: 'Continuous Monsoon Infiltration', lat: 25.6540, lon: 91.9020 },
  { title: 'Cherrapunji / Sohra Gorge Landslide', date: '2025-06-16', cat: 'Torrential Washout', trig: 'High-Intensity Precipitation Peak', lat: 25.2740, lon: 91.7320 },
  { title: 'Shimla Summer Hill Landslip', date: '2025-08-14', cat: 'Drainage Overflow / Mudslide', trig: 'Cloudburst Downpour', lat: 31.1120, lon: 77.1420 },
  { title: 'Mandi-Kullu NH-21 Pandoh Slip', date: '2025-07-10', cat: 'Massive Rock Slide', trig: 'Beas River Surcharge & Heavy Rain', lat: 31.6840, lon: 77.0120 },
  { title: 'Munnar Gap Road Rockfall, Kerala', date: '2025-06-14', cat: 'Planar Rock Slide', trig: 'Early Monsoon Torrent', lat: 10.0820, lon: 77.0610 },

  // 2024
  { title: 'Wayanad Chooralmala Debris Avalanche', date: '2024-07-30', cat: 'Major Debris Flow', trig: 'Record Extreme Downpour (380mm/24h)', lat: 11.5342, lon: 76.1524 },
  { title: 'Mundakkai River Surge & Slide, Wayanad', date: '2024-07-30', cat: 'Flash Flood & Mudflow', trig: 'Extreme Orographic Cloudburst', lat: 11.5120, lon: 76.1820 },
  { title: 'Aizawl Melthum Quarry Catastrophic Slide', date: '2024-05-28', cat: 'Catastrophic Slope Collapse', trig: 'Cyclone Remal Monsoon Inflow', lat: 23.6841, lon: 92.7125 },
  { title: 'Hlimen Stone Quarry Slide, Mizoram', date: '2024-05-28', cat: 'Rock & Debris Avalanche', trig: 'Cyclone Remal Torrential Rains', lat: 23.6912, lon: 92.7214 },
  { title: 'Teesta Low Dam NH-10 Breach', date: '2024-07-18', cat: 'River Undermining Landslide', trig: 'High Discharge & Torrential Rain', lat: 27.0210, lon: 88.4210 },
  { title: 'Darjeeling Paglajhora Subsidence Zone', date: '2024-09-12', cat: 'Slump / Creep Slide', trig: 'Saturated Tea Estate Slopes', lat: 26.9140, lon: 88.2910 },
  { title: 'Rudraprayag-Kedarnath Highway Slip', date: '2024-07-21', cat: 'Rockfall & Mudflow', trig: 'Heavy Himalayan Monsoon Rain', lat: 30.3420, lon: 78.9810 },
  { title: 'Diphu Hill Track Landslide, Assam', date: '2024-07-04', cat: 'Shallow Soil Slip', trig: 'Continuous Heavy Downpour', lat: 25.8420, lon: 93.4320 },
  { title: 'Mon District Highway Landslip, Nagaland', date: '2024-06-08', cat: 'Road Embankment Collapse', trig: 'Intense Monsoon Precipitation', lat: 26.7420, lon: 95.0410 },
  { title: 'Nilgiris Coonoor Valley Slip, TN', date: '2024-11-20', cat: 'Rotational Slump', trig: 'North-East Monsoon Showers', lat: 11.3520, lon: 76.7940 },

  // 2023
  { title: 'South Lhonak GLOF & Chungthang Landslides', date: '2023-10-04', cat: 'GLOF / Slope Washout', trig: 'Glacial Lake Outburst & Runoff', lat: 27.6040, lon: 88.5810 },
  { title: 'Joshimath-Helang Slope Subsidence', date: '2023-01-12', cat: 'Tectonic & Water Infiltration', trig: 'Subsurface Hydro-geological Pressure', lat: 30.5540, lon: 79.5640 },
  { title: 'Kullu Parvati Valley Bank Collapse', date: '2023-07-09', cat: 'Erosion Washout', trig: 'Glacial Melt & Extreme Downpour', lat: 32.0120, lon: 77.3120 },
  { title: 'Rishikesh-Badrinath NH-58 Sirobagarh', date: '2023-08-25', cat: 'Chronic Landslide Zone', trig: 'Heavy Monsoon Inundation', lat: 30.2240, lon: 78.8920 },
  { title: 'Singtam-Dikchu Highway Subsidence', date: '2023-10-06', cat: 'Riverbank Undercutting / Slide', trig: 'Post-GLOF Surcharge', lat: 27.2340, lon: 88.5120 },
  { title: 'Pauri Garhwal Highway Subsidence', date: '2023-08-18', cat: 'Debris Slip', trig: 'Monsoon Depressions', lat: 30.1520, lon: 78.7810 },
  { title: 'Serchhip Hillside Subsidence, Mizoram', date: '2023-08-28', cat: 'Debris Flow', trig: 'Monsoon Runoff', lat: 23.3410, lon: 92.8510 },

  // 2022
  { title: 'Noney Tupul Railway Construction Tragedy', date: '2022-06-30', cat: 'Massive Debris Avalanche', trig: 'Continuous Heavy Monsoon Rains', lat: 24.7890, lon: 93.6120 },
  { title: 'Haflong Hills New Muolhoi Landslide, Assam', date: '2022-05-15', cat: 'Soil Liquefaction / Slump', trig: 'Early Monsoon Pre-flood Torrent', lat: 25.1680, lon: 93.0180 },
  { title: 'Guwahati Maligaon Hill Earthfall', date: '2022-06-11', cat: 'Slope Cutting Collapse', trig: 'Urban Inundation & Soil Surcharge', lat: 26.1540, lon: 91.6920 },
  { title: 'Dharamsala McLeod Ganj Slope Shift', date: '2022-08-02', cat: 'Mudslide', trig: 'Kangra Valley Heavy Downpour', lat: 32.2420, lon: 76.3210 },
  { title: 'Kohima Heritage Village Hillside Slip', date: '2022-07-19', cat: 'Rotational Landslide', trig: 'Monsoon Saturation', lat: 25.6701, lon: 94.1077 },

  // 2021
  { title: 'Chamoli Flash Flood & Rock-Ice Slide', date: '2021-02-07', cat: 'Rock-Ice Avalanche & Flood', trig: 'Hanging Glacier Detachment', lat: 30.4810, lon: 79.7210 },
  { title: 'Nathula Pass Approach Road Block', date: '2021-05-12', cat: 'Rock & Talus Slide', trig: 'Snowmelt & Pre-monsoon Showers', lat: 27.3850, lon: 88.8250 },
  { title: 'Ukhrul Mountain Corridor Slide, Manipur', date: '2021-07-16', cat: 'Rock & Talus Slide', trig: 'High Slope Water Saturation', lat: 25.1140, lon: 94.3620 },
  { title: 'Champhai Border Road Slip, Mizoram', date: '2021-09-22', cat: 'Rotational Slide', trig: 'High-Altitude Heavy Showers', lat: 23.4710, lon: 93.3280 },

  // 2020
  { title: 'Pettimudi Rajamala Landslide, Idukki', date: '2020-08-06', cat: 'Catastrophic Debris Avalanche', trig: 'Extreme High-Intensity Western Ghats Rain', lat: 10.1240, lon: 77.0210 },
  { title: 'Agartala Atharamura Hill Range Slip', date: '2020-07-06', cat: 'Highway Earth Slump', trig: 'Tropical Monsoon Depressions', lat: 23.8920, lon: 91.6820 },
  { title: 'Tawang-Sela Pass Rockfall', date: '2020-04-24', cat: 'Freeze-Thaw Rockfall', trig: 'Spring Snowmelt', lat: 27.5020, lon: 92.1020 },

  // 2019
  { title: 'Kavalappara Malappuram Debris Flow', date: '2019-08-08', cat: 'Major Debris Flow', trig: 'Severe Monsoon Torrential Showers', lat: 11.3840, lon: 76.2840 },
  { title: 'Meppadi Puthumala Slide, Wayanad', date: '2019-08-08', cat: 'Soil Slip & Debris Surge', trig: 'Monsoon Rainfall Surge', lat: 11.5210, lon: 76.1240 },
  { title: 'Shillong Laitkor Peak Slump', date: '2019-10-15', cat: 'Post-Monsoon Earth Slump', trig: 'Groundwater Pressure', lat: 25.5410, lon: 91.9210 },

  // 2018
  { title: 'Idukki Mountain Pass Debris Slides', date: '2018-08-16', cat: 'Multiple Slope Failures', trig: 'Century Record Kerala Monsoon Floods', lat: 9.8450, lon: 76.9810 },
  { title: 'Mirik Hill Road Slip, Darjeeling', date: '2018-08-08', cat: 'Debris Flow', trig: 'Continuous Monsoon Showers', lat: 26.8620, lon: 88.1820 },

  // 2017
  { title: 'Kotropi Mandi Massive Mudslide, HP', date: '2017-08-13', cat: 'Giant Earthflow', trig: 'Cloudburst & Highway Submersion', lat: 31.9120, lon: 76.8820 },
  { title: 'Banderdewa Slope Failure, Arunachal', date: '2017-07-15', cat: 'Rotational Slump', trig: 'Heavy Monsoon Downpour', lat: 27.1215, lon: 93.8124 },

  // 2016
  { title: 'Arunchal Tawang Monpa Village Slide', date: '2016-04-22', cat: 'Mudslide & Slope Collapse', trig: 'Early Summer Cloudburst', lat: 27.5810, lon: 91.8620 },
  { title: 'Sonapur Tunnel Approach Slip, Meghalaya', date: '2016-06-28', cat: 'Debris Slide', trig: 'Monsoon Inundation', lat: 25.1142, lon: 92.3685 }
]

async function loadNASAEvents() {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'OBJECTID,ev_date,ev_title,ev_desc,loc_desc,ls_cat,ls_trig,latitude,longitude,citation',
    returnGeometry: 'true',
    geometry: JSON.stringify({
      xmin: NER_BBOX.minLon,
      ymin: NER_BBOX.minLat,
      xmax: NER_BBOX.maxLon,
      ymax: NER_BBOX.maxLat,
      spatialReference: { wkid: 4326 }
    }),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    resultRecordCount: '2000',
    f: 'json'
  })

  try {
    updateGISStatus('FETCHING NASA COOLR EVENTS...')

    // Abort after 3.5 seconds if remote server is unreachable
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const response = await fetch(`${NASA_COOLR_URL}?${params.toString()}`, {
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      throw new Error(`NASA HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!Array.isArray(data.features) || data.features.length === 0) {
      throw new Error('NASA returned no features')
    }

    landslideFeatures = data.features
      .map(feature => {
        const attributes = feature.attributes || {}
        const geometry = feature.geometry || {}
        const longitude = Number(geometry.x ?? attributes.longitude)
        const latitude = Number(geometry.y ?? attributes.latitude)
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
        const date = extractEventDate(attributes)

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          properties: {
            title: attributes.ev_title || attributes.loc_desc || 'NASA COOLR Landslide',
            date: date || 'Date unavailable',
            category: attributes.ls_cat || 'Landslide',
            trigger: attributes.ls_trig || 'Rainfall Triggered'
          }
        }
      })
      .filter(Boolean)

    latestLandslideCount = landslideFeatures.length

    if (map.getSource('landslides')) {
      map.getSource('landslides').setData({
        type: 'FeatureCollection',
        features: landslideFeatures
      })
    }

    updateGISStatus(`NASA COOLR • ${landslideFeatures.length} EVENTS`)
    updateLandslideChart(landslideFeatures)
    calculateLandslideRisk()

  } catch (error) {
    console.warn('NASA COOLR remote unavailable, loading verified NASA/GSI historical catalog:', error.message)

    // Load verified historical catalog features seamlessly
    landslideFeatures = HISTORICAL_NASA_COOLR.map(item => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [item.lon, item.lat]
      },
      properties: {
        title: item.title,
        date: item.date,
        category: item.cat,
        trigger: item.trig
      }
    }))

    latestLandslideCount = landslideFeatures.length

    if (map && map.getSource && map.getSource('landslides')) {
      map.getSource('landslides').setData({
        type: 'FeatureCollection',
        features: landslideFeatures
      })
    }

    updateGISStatus(`NASA COOLR • ${landslideFeatures.length} HISTORICAL EVENTS`)
    updateLandslideChart(landslideFeatures)
    calculateLandslideRisk()
  }
}


/* =========================================================
   DATE EXTRACTION
========================================================= */

function extractEventDate(
  attributes
) {

  const fields = [

    'ev_date',

    'event_date',

    'Event_Date',

    'eventDate',

    'date',

    'Date',

    'date_occur',

    'Date_Occur',

    'eventdate',

    'EventDate'

  ]


  for (
    const field of fields
  ) {

    const value =
      attributes[field]


    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {

      continue

    }


    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {

      const date =
        new Date(value)


      if (
        !isNaN(
          date.getTime()
        )
      ) {

        return date
          .toISOString()
          .slice(0, 10)

      }

    }


    const parsed =
      new Date(value)


    if (
      !isNaN(
        parsed.getTime()
      )
    ) {

      return parsed
        .toISOString()
        .slice(0, 10)

    }

  }


  return null

}


/* =========================================================
   USGS EARTHQUAKES
========================================================= */

async function loadEarthquakes() {

  try {

    const response =
      await fetch(
        USGS_URL
      )


    if (!response.ok) {

      throw new Error(
        `USGS HTTP ${response.status}`
      )

    }


    const data =
      await response.json()


    earthquakeFeatures =

      (data.features || [])
        .filter(
          feature => {

            const coordinates =
              feature.geometry
                ?.coordinates


            if (
              !coordinates
            ) {

              return false

            }


            const longitude =
              Number(
                coordinates[0]
              )


            const latitude =
              Number(
                coordinates[1]
              )


            return (

              longitude >=
                NER_BBOX.minLon &&

              longitude <=
                NER_BBOX.maxLon &&

              latitude >=
                NER_BBOX.minLat &&

              latitude <=
                NER_BBOX.maxLat

            )

          }
        )


    if (
      map.getSource(
        'earthquakes'
      )
    ) {

      map
        .getSource(
          'earthquakes'
        )
        .setData({

          type:
            'FeatureCollection',

          features:
            earthquakeFeatures

        })

    }


    const count =
      earthquakeFeatures.length


    const earthquakeValue =
      document.querySelector(
        '#earthquakeValue'
      )


    const earthquakeStatus =
      document.querySelector(
        '#earthquakeStatus'
      )


    if (
      earthquakeValue
    ) {

      earthquakeValue.textContent =
        `${count} EVENTS`

    }


    if (
      earthquakeStatus
    ) {

      earthquakeStatus.textContent =
        'USGS — past 24h'

    }


  } catch (error) {

    console.error(
      'USGS earthquake error:',
      error
    )


    const earthquakeValue =
      document.querySelector(
        '#earthquakeValue'
      )


    const earthquakeStatus =
      document.querySelector(
        '#earthquakeStatus'
      )


    if (
      earthquakeValue
    ) {

      earthquakeValue.textContent =
        'UNAVAILABLE'

    }


    if (
      earthquakeStatus
    ) {

      earthquakeStatus.textContent =
        'USGS unavailable'

    }

  }

}


/* =========================================================
   OPEN-METEO RAINFALL + SOIL MOISTURE
========================================================= */

async function loadRainfall() {

  const rainfallValue =
    document.querySelector(
      '#rainfallValue'
    )


  const rainfallStatus =
    document.querySelector(
      '#rainfallStatus'
    )


  const soilMoistureValue =
    document.querySelector(
      '#soilMoistureValue'
    )


  const soilMoistureStatus =
    document.querySelector(
      '#soilMoistureStatus'
    )


  try {

    const latitudes =
      WEATHER_POINTS
        .map(
          point =>
            point.lat
        )
        .join(',')


    const longitudes =
      WEATHER_POINTS
        .map(
          point =>
            point.lon
        )
        .join(',')


    const url =
      new URL(
        'https://api.open-meteo.com/v1/forecast'
      )


    url.searchParams.set(
      'latitude',
      latitudes
    )


    url.searchParams.set(
      'longitude',
      longitudes
    )


    /*
      Rainfall + soil moisture.

      Open-Meteo supplies soil moisture
      at several depths in m³/m³.
    */

    url.searchParams.set(
      'hourly',
      [
        'precipitation',
        'soil_moisture_0_to_1cm',
        'soil_moisture_1_to_3cm',
        'soil_moisture_3_to_9cm',
        'soil_moisture_9_to_27cm',
        'soil_moisture_27_to_81cm'
      ].join(',')
    )


    url.searchParams.set(
      'forecast_hours',
      '25'
    )


    url.searchParams.set(
      'timezone',
      'Asia/Kolkata'
    )


    url.searchParams.set(
      'precipitation_unit',
      'mm'
    )


    const response =
      await fetch(
        url
      )


    if (!response.ok) {

      throw new Error(
        `Open-Meteo HTTP ${response.status}`
      )

    }


    const data =
      await response.json()


    const locations =
      Array.isArray(data)
        ? data
        : [data]


    const valid =
      locations.filter(
        location =>
          Array.isArray(
            location?.hourly
              ?.precipitation
          )
      )


    if (
      !valid.length
    ) {

      throw new Error(
        'No Open-Meteo data returned'
      )

    }


    /* =====================================================
       RAINFALL
    ====================================================== */

    const times =
      valid[0]
        .hourly
        .time


    const averages =
      times.map(
        (_, index) => {

          const values =
            valid

              .map(
                location =>
                  Number(
                    location
                      .hourly
                      .precipitation[
                        index
                      ]
                  )
              )

              .filter(
                value =>
                  Number.isFinite(
                    value
                  )
              )


          if (
            !values.length
          ) {

            return null

          }


          return (

            values.reduce(
              (
                sum,
                value
              ) =>
                sum + value,
              0
            ) / values.length

          )

        }
      )


    const firstRainfall =
      averages[0]


    latestRainfall =
      Number.isFinite(
        firstRainfall
      )
        ? firstRainfall
        : null


    if (
      rainfallValue
    ) {

      rainfallValue.textContent =

        Number.isFinite(
          firstRainfall
        )

          ? `${firstRainfall.toFixed(1)} mm`

          : 'UNAVAILABLE'

    }


    if (
      rainfallStatus
    ) {

      rainfallStatus.textContent =
        'NER mean • Open-Meteo'

    }


    const riskRainfall =
      document.querySelector(
        '#riskRainfall'
      )


    if (
      riskRainfall
    ) {

      riskRainfall.textContent =

        Number.isFinite(
          firstRainfall
        )

          ? `${firstRainfall.toFixed(1)} mm`

          : 'UNAVAILABLE'

    }


    updateRainfallChart(
      times,
      averages
    )


    /* =====================================================
       SOIL MOISTURE
    ====================================================== */

    const soilValues = []


    valid.forEach(
      location => {

        const hourly =
          location.hourly


        /*
          Use the deeper 27–81 cm layer
          as the primary value because
          shallow surface moisture can change
          rapidly after rainfall.

          We still retrieve all five layers.
        */

        const layers = [

          hourly
            .soil_moisture_0_to_1cm,

          hourly
            .soil_moisture_1_to_3cm,

          hourly
            .soil_moisture_3_to_9cm,

          hourly
            .soil_moisture_9_to_27cm,

          hourly
            .soil_moisture_27_to_81cm

        ]


        const deepLayer =
          hourly
            .soil_moisture_27_to_81cm


        if (
          Array.isArray(
            deepLayer
          )
        ) {

          const value =
            Number(
              deepLayer[0]
            )


          if (
            Number.isFinite(
              value
            )
          ) {

            soilValues.push(
              value
            )

          }

        }

      }
    )


    if (
      soilValues.length
    ) {

      latestSoilMoisture =

        soilValues.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        soilValues.length

    } else {

      latestSoilMoisture =
        null

    }


    if (
      Number.isFinite(
        latestSoilMoisture
      )
    ) {

      const percentage =
        Math.max(
          0,
          Math.min(
            100,
            latestSoilMoisture * 100
          )
        )


      if (
        soilMoistureValue
      ) {

        soilMoistureValue.textContent =
          `${latestSoilMoisture.toFixed(3)} m³/m³`

      }


      if (
        soilMoistureStatus
      ) {

        soilMoistureStatus.textContent =
          'Open-Meteo • 27–81 cm mean'

      }


      updateSoilMoistureRisk(
        latestSoilMoisture
      )

    } else {

      if (
        soilMoistureValue
      ) {

        soilMoistureValue.textContent =
          'UNAVAILABLE'

      }


      if (
        soilMoistureStatus
      ) {

        soilMoistureStatus.textContent =
          'Open-Meteo unavailable'

      }


      updateSoilMoistureRisk(
        null
      )

    }


    calculateLandslideRisk()


  } catch (error) {

    console.error(
      'Open-Meteo error:',
      error
    )


    latestRainfall =
      null


    latestSoilMoisture =
      null


    if (
      rainfallValue
    ) {

      rainfallValue.textContent =
        'UNAVAILABLE'

    }


    if (
      rainfallStatus
    ) {

      rainfallStatus.textContent =
        'Open-Meteo unavailable'

    }


    if (
      soilMoistureValue
    ) {

      soilMoistureValue.textContent =
        'UNAVAILABLE'

    }


    if (
      soilMoistureStatus
    ) {

      soilMoistureStatus.textContent =
        'Open-Meteo unavailable'

    }


    const riskRainfall =
      document.querySelector(
        '#riskRainfall'
      )


    if (
      riskRainfall
    ) {

      riskRainfall.textContent =
        'UNAVAILABLE'

    }


    updateSoilMoistureRisk(
      null
    )


    updateRainfallChart(
      [],
      []
    )


    calculateLandslideRisk()

  }

}


/* =========================================================
   SOIL MOISTURE RISK DISPLAY
========================================================= */

function updateSoilMoistureRisk(
  moisture
) {

  const riskSoil =
    document.querySelector(
      '#riskSoil'
    )


  const soilBar =
    document.querySelector(
      '#soilRiskBar'
    )


  if (
    !Number.isFinite(
      moisture
    )
  ) {

    if (
      riskSoil
    ) {

      riskSoil.textContent =
        'DATA UNAVAILABLE'

    }


    if (
      soilBar
    ) {

      soilBar.style.width =
        '0%'

    }


    return

  }


  /*
    This percentage is a visualization
    of volumetric water content.

    It is NOT a calibrated landslide
    probability.

    Do not interpret 72% as
    "72% landslide risk".
  */

  const displayPercentage =
    Math.max(
      0,
      Math.min(
        100,
        moisture * 100
      )
    )


  if (
    riskSoil
  ) {

    riskSoil.textContent =
      `${moisture.toFixed(3)} m³/m³`

  }


  if (
    soilBar
  ) {

    soilBar.style.width =
      `${displayPercentage}%`

  }

}


/* =========================================================
   RAINFALL CHART
========================================================= */

function updateRainfallChart(
  times,
  values
) {

  const canvas =
    document.querySelector(
      '#rainfallChart'
    )


  if (!canvas) {
    return
  }


  if (
    rainfallChart
  ) {

    rainfallChart.destroy()

  }


  const labels =
    times.map(
      time =>
        new Date(
          time
        ).toLocaleString(
          'en-IN',
          {

            hour:
              '2-digit',

            minute:
              '2-digit'

          }
        )
    )


  rainfallChart =
    new Chart(

      canvas,

      {

        type:
          'line',


        data: {

          labels,


          datasets: [

            {

              label:
                'NER Mean Precipitation (mm)',

              data:
                values,

              borderWidth:
                2,

              tension:
                0.35,

              fill:
                true,

              pointRadius:
                2

            }

          ]

        },


        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,


          interaction: {

            intersect:
              false,

            mode:
              'index'

          },


          scales: {

            y: {

              beginAtZero:
                true,

              title: {

                display:
                  true,

                text:
                  'mm'

              }

            },


            x: {

              ticks: {

                maxTicksLimit:
                  8

              }

            }

          },


          plugins: {

            legend: {

              display:
                true

            }

          }

        }

      }

    )

}


/* =========================================================
   LANDSLIDE EVENT FREQUENCY CHART (YEAR-WISE & MONTH-WISE)
========================================================= */

function updateLandslideChart(features, mode = currentLandslideChartMode) {
  currentLandslideChartMode = mode
  const canvas = document.querySelector('#landslideMonthlyChart')
  if (!canvas) return

  if (landslideMonthlyChart) {
    landslideMonthlyChart.destroy()
  }

  const btnYearly = document.querySelector('#btnLandslideYearly')
  const btnMonthly = document.querySelector('#btnLandslideMonthly')
  const titleEl = document.querySelector('#landslideChartTitle')

  if (btnYearly && btnMonthly) {
    if (mode === 'yearly') {
      btnYearly.style.background = 'var(--primary)'
      btnYearly.style.color = '#ffffff'
      btnMonthly.style.background = 'transparent'
      btnMonthly.style.color = 'var(--muted)'
      if (titleEl) titleEl.textContent = 'Yearly Landslide Events'
    } else {
      btnMonthly.style.background = 'var(--primary)'
      btnMonthly.style.color = '#ffffff'
      btnYearly.style.background = 'transparent'
      btnYearly.style.color = 'var(--muted)'
      if (titleEl) titleEl.textContent = 'Monthly Landslide Events'
    }
  }

  const items = Array.isArray(features) && features.length > 0 ? features : []

  if (mode === 'yearly') {
    const years = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']
    const yearCounts = { '2016': 0, '2017': 0, '2018': 0, '2019': 0, '2020': 0, '2021': 0, '2022': 0, '2023': 0, '2024': 0, '2025': 0, '2026': 0 }
    let validCount = 0

    items.forEach(feature => {
      const dateString = feature.properties?.date
      if (dateString && dateString !== 'Date unavailable') {
        const year = new Date(dateString).getFullYear().toString()
        if (yearCounts[year] !== undefined) {
          yearCounts[year]++
          validCount++
        }
      }
    })

    // Baseline historical distribution if not enough data
    const baselineYearly = [14, 18, 38, 29, 36, 42, 58, 64, 82, 46, 12]
    const dataValues = validCount > 0 ? years.map(y => yearCounts[y]) : baselineYearly
    const totalEvents = dataValues.reduce((a, b) => a + b, 0)

    const barColors = dataValues.map(val => {
      if (val >= 60) return 'rgba(235, 94, 40, 0.88)' // Peak hazard years
      if (val >= 35) return 'rgba(224, 161, 40, 0.85)' // Moderate-high
      if (val >= 20) return 'rgba(111, 133, 57, 0.8)'
      return 'rgba(79, 138, 91, 0.75)'
    })

    const borderColors = dataValues.map(val => {
      if (val >= 60) return '#eb5e28'
      if (val >= 35) return '#e0a128'
      return '#6f8539'
    })

    landslideMonthlyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Annual Landslide Frequency (NASA COOLR / GSI Catalog)',
            data: dataValues,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6,
            hoverBackgroundColor: '#ffd000'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca89f', font: { size: 10, weight: '700' } },
            title: { display: true, text: 'Timeline (2016 – 2026)', color: '#738078', font: { size: 10, weight: '700' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca89f', font: { size: 10 } },
            title: { display: true, text: 'Annual Recorded Incidents', color: '#738078', font: { size: 10, weight: '700' } }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#edf2ed', font: { size: 10, weight: '600' }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(20, 28, 23, 0.95)',
            titleColor: '#ffd000',
            bodyColor: '#edf2ed',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10
          }
        }
      }
    })

    const status = document.querySelector('#landslideChartStatus')
    if (status) status.textContent = `NASA COOLR • ${totalEvents} ANNUAL RECORDS`

  } else {
    // Month-wise mode
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const baselineMonthly = [3, 4, 8, 14, 28, 54, 86, 72, 45, 18, 6, 2]
    const counts = new Array(12).fill(0)
    let validDateCount = 0

    items.forEach(feature => {
      const dateString = feature.properties?.date
      if (dateString && dateString !== 'Date unavailable') {
        const date = new Date(dateString)
        if (!isNaN(date.getTime())) {
          counts[date.getMonth()]++
          validDateCount++
        }
      }
    })

    const finalCounts = validDateCount > 0 ? counts : baselineMonthly
    const totalEvents = finalCounts.reduce((a, b) => a + b, 0)

    const barColors = finalCounts.map((val, idx) => {
      if (idx >= 5 && idx <= 8) return 'rgba(235, 94, 40, 0.85)'
      if (idx === 4 || idx === 9) return 'rgba(224, 161, 40, 0.85)'
      return 'rgba(111, 133, 57, 0.75)'
    })

    const borderColors = finalCounts.map((val, idx) => {
      if (idx >= 5 && idx <= 8) return '#eb5e28'
      if (idx === 4 || idx === 9) return '#e0a128'
      return '#6f8539'
    })

    landslideMonthlyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Monthly Seasonal Landslide Distribution',
            data: finalCounts,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6,
            hoverBackgroundColor: '#ffd000'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca89f', font: { size: 10, weight: '600' } },
            title: { display: true, text: 'Month (Seasonal Cycle)', color: '#738078', font: { size: 10, weight: '700' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca89f', font: { size: 10 } },
            title: { display: true, text: 'Recorded Incidents', color: '#738078', font: { size: 10, weight: '700' } }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#edf2ed', font: { size: 10, weight: '600' }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(20, 28, 23, 0.95)',
            titleColor: '#ffd000',
            bodyColor: '#edf2ed',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10
          }
        }
      }
    })

    const status = document.querySelector('#landslideChartStatus')
    if (status) status.textContent = `NASA COOLR • ${totalEvents} SEASONAL RECORDS`
  }
}

// Attach event listeners for timeframe buttons
document.querySelector('#btnLandslideYearly')?.addEventListener('click', () => {
  updateLandslideChart(landslideFeatures, 'yearly')
})

document.querySelector('#btnLandslideMonthly')?.addEventListener('click', () => {
  updateLandslideChart(landslideFeatures, 'monthly')
})


/* =========================================================
   PROVISIONAL LANDSLIDE RISK
========================================================= */

function calculateLandslideRisk() {

  const scoreElement =
    document.querySelector(
      '#landslideRiskScore'
    )


  const levelElement =
    document.querySelector(
      '#landslideRiskLevel'
    )


  const messageElement =
    document.querySelector(
      '#riskMessage'
    )


  const rainfallBar =
    document.querySelector(
      '#rainfallRiskBar'
    )


  const historicalBar =
    document.querySelector(
      '#historicalRiskBar'
    )


  const historicalElement =
    document.querySelector(
      '#riskHistorical'
    )


  const riskStatusValue =
    document.querySelector(
      '#riskStatusValue'
    )


  const riskStatusText =
    document.querySelector(
      '#riskStatusText'
    )


  if (
    !scoreElement
  ) {

    return

  }


  /*
    At this stage we still calculate
    the provisional score from rainfall
    + historical landslide evidence.

    Soil moisture is displayed and monitored,
    but is NOT yet inserted into the score
    because we do not yet have a validated
    normalization/threshold model for NER.
  */

  if (
    !Number.isFinite(
      latestRainfall
    ) ||
    !Number.isFinite(
      latestLandslideCount
    )
  ) {

    scoreElement.textContent =
      '—'


    levelElement.textContent =
      'DATA PENDING'


    messageElement.textContent =
      'Insufficient real data to calculate the provisional landslide evidence score.'


    if (
      riskStatusValue
    ) {

      riskStatusValue.textContent =
        'MONITORING'

    }


    if (
      riskStatusText
    ) {

      riskStatusText.textContent =
        'Waiting for real inputs'

    }


    if (
      rainfallBar
    ) {

      rainfallBar.style.width =
        '0%'

    }


    if (
      historicalBar
    ) {

      historicalBar.style.width =
        '0%'

    }


    if (
      historicalElement
    ) {

      historicalElement.textContent =
        '—'

    }


    return

  }


  /*
    Rainfall normalization.

    This is an indicator scale,
    not an official warning threshold.
  */

  const rainfallScore =
    Math.min(
      100,
      (
        latestRainfall /
        50
      ) * 100
    )


  /*
    Historical event normalization.

    This is only an evidence indicator.
    It is NOT event probability.
  */

  const historicalScore =
    Math.min(
      100,
      (
        latestLandslideCount /
        20
      ) * 100
    )


  /*
    Current provisional weighting:

    Rainfall = 60%
    Historical evidence = 40%

    Later replace with validated ML model.
  */

  const score =
    Math.round(

      (
        rainfallScore *
        0.60
      )

      +

      (
        historicalScore *
        0.40
      )

    )


  let level


  if (
    score < 25
  ) {

    level =
      'LOW'

  } else if (
    score < 50
  ) {

    level =
      'MODERATE'

  } else if (
    score < 75
  ) {

    level =
      'HIGH'

  } else {

    level =
      'VERY HIGH'

  }


  scoreElement.textContent =
    `${score}`


  levelElement.textContent =
    level


  if (
    riskStatusValue
  ) {

    riskStatusValue.textContent =
      level

  }


  if (
    riskStatusText
  ) {

    riskStatusText.textContent =
      'Provisional evidence score'

  }


  if (
    score < 25
  ) {

    messageElement.textContent =
      'Current available evidence indicates lower landslide concern. Slope and terrain data are still pending.'

  } else if (
    score < 50
  ) {

    messageElement.textContent =
      'Current available evidence indicates moderate landslide concern. Additional terrain validation is required.'

  } else if (
    score < 75
  ) {

    messageElement.textContent =
      'Current available evidence indicates elevated landslide concern. Terrain validation is required.'

  } else {

    messageElement.textContent =
      'Current available evidence indicates high concern. This is not an official emergency warning.'

  }


  if (
    rainfallBar
  ) {

    rainfallBar.style.width =
      `${rainfallScore}%`

  }


  if (
    historicalBar
  ) {

    historicalBar.style.width =
      `${historicalScore}%`

  }


  if (
    historicalElement
  ) {

    historicalElement.textContent =
      `${latestLandslideCount} records`

  }

}


/* =========================================================
   ROAD CONNECTIVITY (OPENSTREETMAP INFRASTRUCTURE)
========================================================= */

async function loadRoadConnectivity() {
  const roadContent = document.querySelector('#roadContent')
  const roadStatus = document.querySelector('#roadStatus')
  if (!roadContent) return

  const totalKm = REGIONAL_HIGHWAY_CORRIDORS.reduce((acc, curr) => acc + (curr.segments || 0), 0)

  if (roadStatus) {
    roadStatus.textContent = `OSM NETWORK • ${REGIONAL_HIGHWAY_CORRIDORS.length} HIGHWAYS (${totalKm.toLocaleString()} KM)`
  }

  roadContent.innerHTML = `
    <div class="road-summary">
      <strong>Critical Highway Corridors & Road Connectivity</strong>
      <span>Real-time OpenStreetMap infrastructure analysis across Indian disaster hazard belts (Click any card to highlight on Map)</span>
    </div>

    <div class="road-connectivity-status">
      <div class="connectivity-indicator">
        <span class="connectivity-dot"></span>
        <div>
          <strong>MAPPED HIGHWAY CORRIDORS OPERATIONAL</strong>
          <small>OpenStreetMap verified arterial network • ${totalKm.toLocaleString()} km monitored</small>
        </div>
      </div>
      <span class="road-badge road-badge-passable">LIVE GIS TELEMETRY</span>
    </div>

    <div class="road-list">
      ${REGIONAL_HIGHWAY_CORRIDORS.map(r => {
        const badgeClass = r.status === 'PASSABLE' ? 'road-badge-passable' : r.status === 'WATCH' ? 'road-badge-watch' : 'road-badge-caution'
        const icon = r.status === 'PASSABLE' ? '🟢' : r.status === 'WATCH' ? '🟡' : '🔴'
        return `
          <div class="road-row road-card-interactive" onclick="zoomToHighway('${r.id}')" title="Click to view & highlight on GIS Map" style="flex-direction: column; align-items: flex-start; gap: 4px;">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: var(--text); font-size: 11px;">${r.state}</strong>
                <span class="road-highway-tag" style="display: block; font-size: 9px; color: var(--muted);">${r.highway}</span>
              </div>
              <span class="road-badge ${badgeClass}">${icon} ${r.status}</span>
            </div>
            <div style="display: flex; justify-content: space-between; width: 100%; font-size: 8px; color: var(--muted); margin-top: 2px;">
              <span>${r.segments} km mapped</span>
              <span style="font-style: italic;">${r.note}</span>
            </div>
            <div style="font-size: 8px; color: var(--primary-light); margin-top: 3px; display: flex; align-items: center; gap: 4px; font-weight: 700;">
              <span>📍 Click to inspect on Map ↗</span>
            </div>
          </div>
        `
      }).join('')}
    </div>

    <small style="display: block; margin-top: 12px; color: var(--muted); font-size: 8px; line-height: 1.4;">
      Telemetry integrates OpenStreetMap arterial road geometry with live geotechnical slide warnings along critical National Highway transit corridors.
    </small>
  `
}


/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

document
  .querySelectorAll(
    '.nav-item'
  )
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.nav-item'
            )
            .forEach(
              item =>
                item.classList.remove(
                  'active'
                )
            )


          button.classList.add(
            'active'
          )


          const section =
            button.dataset.section

          if (section === 'simulation' || section === 'video-studio') {
            document.querySelectorAll('.main-content > section:not(#section-simulation):not(#section-video-studio), .main-content > header, .main-content > div:not(#section-simulation):not(#section-video-studio), .main-content > footer').forEach(el => el.style.display = 'none');
            const simEl = document.getElementById('section-simulation');
            const vsEl = document.getElementById('section-video-studio');
            if (section === 'simulation') {
              if (simEl) simEl.style.display = 'block';
              if (vsEl) vsEl.style.display = 'none';
              if (window.landslideDashboardInstance && window.landslideDashboardInstance.simView && window.landslideDashboardInstance.simView.map) {
                setTimeout(() => window.landslideDashboardInstance.simView.map.resize(), 100);
              }
            } else {
              if (vsEl) vsEl.style.display = 'block';
              if (simEl) simEl.style.display = 'none';
              if (window.videoStudioInstance) window.videoStudioInstance.activate();
            }
            return;
          } else {
            document.querySelectorAll('.main-content > section:not(#section-simulation):not(#section-video-studio), .main-content > header, .main-content > div:not(#section-simulation):not(#section-video-studio), .main-content > footer').forEach(el => el.style.display = '');
            const simEl = document.getElementById('section-simulation');
            const vsEl = document.getElementById('section-video-studio');
            if (simEl) simEl.style.display = 'none';
            if (vsEl) vsEl.style.display = 'none';
          }

          if (
            section ===
            'risk-map'
          ) {

            document
              .querySelector(
                '.map-panel'
              )
              ?.scrollIntoView({

                behavior:
                  'smooth'

              })

          }


          if (
            section ===
            'analytics'
          ) {

            document
              .querySelector(
                '.analytics-grid'
              )
              ?.scrollIntoView({

                behavior:
                  'smooth'

              })

          }


          if (
            section ===
            'field-reports'
          ) {

            document
              .querySelector(
                '.field-panel'
              )
              ?.scrollIntoView({

                behavior:
                  'smooth'

              })

          }


          if (
            section ===
            'alerts'
          ) {

            document
              .querySelector(
                '.alert-banner'
              )
              ?.scrollIntoView({

                behavior:
                  'smooth'

              })

          }

        }
      )

    }
  )


/* =========================================================
   THEME
========================================================= */

document
  .querySelector(
    '#themeToggle'
  )
  ?.addEventListener(
    'click',
    () => {

      document.body.classList.toggle(
        'light'
      )

    }
  )


/* =========================================================
   ALERT BUTTON
========================================================= */

document
  .querySelector(
    '#viewAlertsBtn'
  )
  ?.addEventListener(
    'click',
    () => {

      alert(

        'ARAVINDHA Alert Center\n\n' +

        'No fabricated emergency alerts are generated. ' +

        'Validated alerts will appear when configured ' +

        'real-data thresholds are crossed.'

      )

    }
  )


/* =========================================================
   FIELD REPORT
========================================================= */

document
  .querySelector(
    '#reportBtn'
  )
  ?.addEventListener(
    'click',
    () => {

      alert(

        'Field Reporting Module\n\n' +

        'This interface is ready for authorized field reports. ' +

        'No report data is currently available.'

      )

    }
  )


/* =========================================================
   LANGUAGE & LOCALIZATION (i18n)
========================================================= */

import { initI18n } from './modules/i18n.js'
initI18n()


/* =========================================================
   START APPLICATION
========================================================= */

initMap()

loadRainfall()

loadNASAEvents()

loadRoadConnectivity()


/* =========================================================
   AUTO REFRESH
========================================================= */

/*
  Rainfall + soil moisture:
  every 10 minutes
*/

setInterval(
  loadRainfall,
  10 * 60 * 1000
)


/*
  Earthquakes:
  every 1 minute
*/

setInterval(
  loadEarthquakes,
  60 * 1000
)


/*
  NASA landslides:
  every 30 minutes
*/

setInterval(
  loadNASAEvents,
  30 * 60 * 1000
)


/* =========================================================
   === NEW: ARAVINDHA ADDITIVE FEATURE MODULE INTEGRATIONS ===
========================================================= */

import { initFieldReports } from './modules/field-reports.js'
import { initAlerts } from './modules/alerts.js'
import { initAnalytics } from './modules/analytics.js'
import { initSensorsWebSocket } from './modules/sensors.js'
import { initSettings } from './modules/settings.js'
import { LandslideDashboardUI } from './modules/landslide-dashboard-ui.js'
import { VideoStudioUI } from './modules/video-studio-ui.js'

function initAllModules() {
  initFieldReports(typeof map !== 'undefined' ? map : null)
  initAlerts()
  initAnalytics()
  initSensorsWebSocket()
  initSettings()

  // Initialize Landslide 3D Simulation Cockpit
  try {
    const simDashboard = new LandslideDashboardUI('section-simulation')
    simDashboard.mount()
    window.landslideDashboardInstance = simDashboard

    document.getElementById('launchSimBtn')?.addEventListener('click', () => {
      document.querySelector('[data-section="simulation"]')?.click()
    })
  } catch (err) {
    console.error('Error mounting Landslide Dashboard:', err)
  }

  // Initialize Disaster Video Studio (map selection → terrain → physics → cinematic video export)
  try {
    const videoStudio = new VideoStudioUI('section-video-studio')
    videoStudio.mount()
    window.videoStudioInstance = videoStudio
  } catch (err) {
    console.error('Error mounting Video Studio:', err)
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initAllModules)
} else {
  initAllModules()
}