/**
 * ARAVINDHA Mobile Field Reporting App
 * Direct camera capture + GPS geotagging + IndexedDB offline queue + Auto Sync
 */

const API_BASE = window.location.origin.includes('localhost')
  ? 'http://localhost:4000/api'
  : '/api';

let currentLat = null;
let currentLon = null;
let db = null;

// Initialize IndexedDB for offline report queue
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ARAVINDHA_Field_DB', 1);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('reports_queue')) {
        database.createObjectStore('reports_queue', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      console.log('[IndexedDB] Field reports queue store initialized.');
      resolve(db);
    };
    request.onerror = (err) => reject(err);
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered successfully scope:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// Network Status Monitoring
function updateNetworkStatus() {
  const banner = document.getElementById('offlineBanner');
  const statusText = document.getElementById('networkText');
  
  if (navigator.onLine) {
    banner.classList.add('online');
    statusText.textContent = '🟢 Online — Connected to ARAVINDHA Node';
    syncOfflineQueue();
  } else {
    banner.classList.remove('online');
    getQueueCount().then(count => {
      statusText.textContent = `⚠️ Offline — ${count} Report(s) Queued Locally`;
    });
  }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// GPS Geolocation Capture
function captureGPS() {
  const gpsDisplay = document.getElementById('gpsDisplay');
  gpsDisplay.textContent = 'Acquiring high-accuracy GPS fix...';
  
  if (!navigator.geolocation) {
    gpsDisplay.textContent = 'Geolocation not supported. Enter coordinates manually.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLat = position.coords.latitude;
      currentLon = position.coords.longitude;
      const acc = position.coords.accuracy;
      gpsDisplay.innerHTML = `📍 <strong>${currentLat.toFixed(5)}, ${currentLon.toFixed(5)}</strong> (Accuracy: ±${acc.toFixed(1)}m)`;
      document.getElementById('manualLat').value = currentLat;
      document.getElementById('manualLon').value = currentLon;
    },
    (error) => {
      console.warn('[GPS Error]', error.message);
      gpsDisplay.textContent = 'GPS permission denied or indoor signal lost. Using manual override.';
      document.getElementById('manualGpsBox').style.display = 'block';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Camera photo preview
document.getElementById('photoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const preview = document.getElementById('photoPreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    document.getElementById('cameraPrompt').style.display = 'none';
  }
});

// Queue report offline in IndexedDB
async function queueReportOffline(reportData) {
  if (!db) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports_queue', 'readwrite');
    const store = tx.objectStore('reports_queue');
    store.put(reportData);
    tx.oncomplete = () => {
      updateNetworkStatus();
      resolve();
    };
    tx.onerror = (err) => reject(err);
  });
}

// Get queued report count
async function getQueueCount() {
  if (!db) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = db.transaction('reports_queue', 'readonly');
    const store = tx.objectStore('reports_queue');
    const countReq = store.count();
    countReq.onsuccess = () => resolve(countReq.result);
  });
}

// Sync queued offline reports when back online
async function syncOfflineQueue() {
  if (!navigator.onLine || !db) return;
  
  const tx = db.transaction('reports_queue', 'readwrite');
  const store = tx.objectStore('reports_queue');
  const getAllReq = store.getAll();
  
  getAllReq.onsuccess = async () => {
    const queuedReports = getAllReq.result;
    if (queuedReports.length === 0) return;
    
    console.log(`[Offline Sync] Flushing ${queuedReports.length} queued reports...`);
    for (const report of queuedReports) {
      try {
        const formData = new FormData();
        formData.append('title', report.title);
        formData.append('hazard_type', report.hazard_type);
        formData.append('severity', report.severity);
        formData.append('description', report.description);
        formData.append('latitude', report.latitude);
        formData.append('longitude', report.longitude);
        formData.append('submitter', report.submitter);
        
        if (report.photoBlob) {
          formData.append('photo', report.photoBlob, `report_${report.id}.jpg`);
        }

        const res = await fetch(`${API_BASE}/field-reports`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          // Remove from local IndexedDB queue
          const deleteTx = db.transaction('reports_queue', 'readwrite');
          deleteTx.objectStore('reports_queue').delete(report.id);
          console.log(`[Offline Sync] Report ${report.id} synced successfully!`);
        }
      } catch (err) {
        console.warn(`[Offline Sync] Sync failed for ${report.id}:`, err.message);
      }
    }
    renderQueueList();
    updateNetworkStatus();
  };
}

// Render queue list in UI
async function renderQueueList() {
  if (!db) await initIndexedDB();
  const tx = db.transaction('reports_queue', 'readonly');
  const store = tx.objectStore('reports_queue');
  const getAllReq = store.getAll();
  
  getAllReq.onsuccess = () => {
    const listEl = document.getElementById('queueList');
    listEl.innerHTML = '';
    const items = getAllReq.result;
    if (items.length === 0) {
      listEl.innerHTML = '<li style="color: var(--text-muted); font-size:0.85rem;">All reports synchronized with command center.</li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.innerHTML = `
        <div>
          <strong>${item.title}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${item.hazard_type} • ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}</div>
        </div>
        <span class="badge badge-pending">OFFLINE QUEUED</span>
      `;
      listEl.appendChild(li);
    });
  };
}

// Form Submit Handler
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('title').value;
  const hazard_type = document.getElementById('hazardType').value;
  const severity = document.getElementById('severity').value;
  const description = document.getElementById('description').value;
  const submitter = document.getElementById('submitter').value || 'Field Officer';
  
  const manualLat = parseFloat(document.getElementById('manualLat').value);
  const manualLon = parseFloat(document.getElementById('manualLon').value);
  
  const lat = currentLat !== null ? currentLat : (isNaN(manualLat) ? 26.1445 : manualLat);
  const lon = currentLon !== null ? currentLon : (isNaN(manualLon) ? 91.7362 : manualLon);
  
  const fileInput = document.getElementById('photoInput');
  const file = fileInput.files[0];

  const reportId = `OFF-${Date.now()}`;
  const reportPayload = {
    id: reportId,
    title,
    hazard_type,
    severity,
    description,
    latitude: lat,
    longitude: lon,
    submitter,
    timestamp: new Date().toISOString(),
    photoBlob: file || null
  };

  if (navigator.onLine) {
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('hazard_type', hazard_type);
      formData.append('severity', severity);
      formData.append('description', description);
      formData.append('latitude', lat);
      formData.append('longitude', lon);
      formData.append('submitter', submitter);
      if (file) formData.append('photo', file);

      const res = await fetch(`${API_BASE}/field-reports`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert('Report transmitted successfully to ARAVINDHA Command Center!');
        document.getElementById('reportForm').reset();
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('cameraPrompt').style.display = 'block';
        return;
      }
    } catch (err) {
      console.warn('Online submit failed, storing offline queue:', err);
    }
  }

  // Queue offline
  await queueReportOffline(reportPayload);
  alert('Network unavailable or slow. Report saved safely to local offline queue!');
  document.getElementById('reportForm').reset();
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('cameraPrompt').style.display = 'block';
  renderQueueList();
});

// App Initialization
window.addEventListener('DOMContentLoaded', async () => {
  await initIndexedDB();
  captureGPS();
  updateNetworkStatus();
  renderQueueList();
  
  document.getElementById('refreshGpsBtn').addEventListener('click', captureGPS);
  document.getElementById('retrySyncBtn').addEventListener('click', syncOfflineQueue);
});
