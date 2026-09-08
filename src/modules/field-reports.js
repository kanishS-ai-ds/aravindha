/**
 * ARAVINDHA Dashboard — Field Reports Module
 * Geotagged Field Intelligence Integration & MapLibre Layer Overlay
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:4000/api'
  : '/api';

let mapInstance = null;

export function initFieldReports(map) {
  mapInstance = map;
  fetchAndRenderFieldReports();

  // Re-fetch periodically
  setInterval(fetchAndRenderFieldReports, 10000);
}

export async function fetchAndRenderFieldReports() {
  try {
    const res = await fetch(`${API_BASE}/field-reports`);
    if (!res.ok) return;
    const reports = await res.json();

    renderFieldReportCards(reports);
    updateMapFieldReportPins(reports);
  } catch (err) {
    console.warn('[Field Reports Module] API server pending connection:', err.message);
  }
}

function renderFieldReportCards(reports) {
  const panel = document.querySelector('.field-panel');
  if (!panel) return;

  if (!reports || reports.length === 0) {
    return;
  }

  // Find or create container inside field-panel
  let container = panel.querySelector('.field-reports-grid');
  if (!container) {
    const emptyState = panel.querySelector('.field-empty');
    if (emptyState) emptyState.style.display = 'none';

    container = document.createElement('div');
    container.className = 'field-reports-grid';
    panel.appendChild(container);
  }

  container.innerHTML = reports.map(report => `
    <div class="field-card" data-report-id="${report.id}">
      <div class="field-card-header">
        <div>
          <span class="field-badge badge-${(report.severity || 'MODERATE').toLowerCase()}">${report.severity || 'MODERATE'}</span>
          <span class="field-type">${report.hazard_type || 'Landslide'}</span>
        </div>
        <small class="field-time">${new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
      </div>

      <div class="field-card-body">
        <div class="field-photo-box">
          <img src="${report.photo_url.startsWith('/') ? 'http://localhost:4000' + report.photo_url : report.photo_url}" 
               alt="${report.title}" 
               onerror="this.src='https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500&auto=format&fit=crop&q=60'">
        </div>
        <div class="field-details">
          <h4>${report.title}</h4>
          <p>${report.description || 'Geotagged report submitted by field team.'}</p>
          <div class="field-meta">
            <span>📍 ${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}</span>
            <span>👤 ${report.submitter || 'Field Officer'}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function updateMapFieldReportPins(reports) {
  if (!mapInstance || !reports || reports.length === 0) return;

  const geojson = {
    type: 'FeatureCollection',
    features: reports.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.longitude, r.latitude]
      },
      properties: {
        id: r.id,
        title: r.title,
        hazard: r.hazard_type,
        severity: r.severity,
        submitter: r.submitter
      }
    }))
  };

  // Add or update MapLibre GeoJSON source cleanly without touching existing layers
  if (mapInstance.getSource('field-reports-source')) {
    mapInstance.getSource('field-reports-source').setData(geojson);
  } else {
    mapInstance.addSource('field-reports-source', {
      type: 'geojson',
      data: geojson
    });

    mapInstance.addLayer({
      id: 'field-reports-layer',
      type: 'circle',
      source: 'field-reports-source',
      paint: {
        'circle-radius': 9,
        'circle-color': [
          'match',
          ['get', 'severity'],
          'SEVERE', '#ff0055',
          'HIGH', '#ff9900',
          'MODERATE', '#ffcc00',
          '#00ccff'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add interactive popup on pin click
    mapInstance.on('click', 'field-reports-layer', (e) => {
      const props = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates.slice();

      if (window.maplibregl) {
        new window.maplibregl.Popup()
          .setLngLat(coords)
          .setHTML(`
            <div style="color:#000; font-family:sans-serif; padding:4px;">
              <strong style="color:#e63946;">[${props.severity}] ${props.hazard}</strong>
              <div style="font-size:0.9rem; margin-top:2px;">${props.title}</div>
              <small style="color:#555;">Submitted by ${props.submitter}</small>
            </div>
          `)
          .addTo(mapInstance);
      }
    });
  }
}
