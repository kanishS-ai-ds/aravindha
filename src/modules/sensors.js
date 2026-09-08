/**
 * ARAVINDHA Dashboard — WebSockets & Live Sensor Stream Module
 */

import { fetchAndRenderFieldReports } from './field-reports.js';
import { fetchLatestMLPredictions } from './analytics.js';
import { fetchAndRenderAlertHistory } from './alerts.js';

let socket = null;

export function initSensorsWebSocket() {
  const wsUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:4000'
    : window.location.origin;

  // Load Socket.IO client library dynamically if not present
  if (typeof window.io === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    script.onload = () => connectSocket(wsUrl);
    document.head.appendChild(script);
  } else {
    connectSocket(wsUrl);
  }
}

function connectSocket(wsUrl) {
  try {
    socket = window.io(wsUrl, { reconnectionAttempts: 5, timeout: 5000 });

    socket.on('connect', () => {
      console.log('📡 Connected to ARAVINDHA Socket.IO Realtime Gateway');
      updateSystemOnlineIndicator(true);
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Realtime WebSocket disconnected');
      updateSystemOnlineIndicator(false);
    });

    // Realtime Events
    socket.on('new_field_report', (report) => {
      console.log('⚡ Live Field Report received:', report);
      fetchAndRenderFieldReports();
      showToastNotification(`New Field Report: ${report.title}`, report.hazard_type);
    });

    socket.on('risk_update', (data) => {
      console.log('⚡ Risk Update received:', data);
      fetchLatestMLPredictions();
    });

    socket.on('system_alert', (alert) => {
      console.warn('🚨 SYSTEM ALERT:', alert);
      showToastNotification(`🚨 ${alert.title}`, alert.message);
      fetchAndRenderAlertHistory();
    });

    socket.on('sensor_reading', (reading) => {
      updateSensorWidgetUI(reading);
    });
  } catch (err) {
    console.warn('[WebSocket Init Error]', err.message);
  }
}

function updateSystemOnlineIndicator(isOnline) {
  const dots = document.querySelectorAll('.status-dot');
  dots.forEach(d => {
    d.style.backgroundColor = isOnline ? '#38b000' : '#ff4d6d';
  });
}

function updateSensorWidgetUI(reading) {
  if (reading.type === 'soil_moisture') {
    const soilVal = document.querySelector('#soilMoistureValue');
    if (soilVal) soilVal.textContent = `${reading.value}%`;
  }
}

function showToastNotification(title, body) {
  const toast = document.createElement('div');
  toast.className = 'live-toast';
  toast.innerHTML = `
    <strong>${title}</strong>
    <p>${body}</p>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}
