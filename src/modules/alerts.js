/**
 * ARAVINDHA Dashboard — Alerts & Early Warning System Module
 * Manual SMS Trigger Modal + Realtime Alert Feed + Audit Logs
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:4000/api'
  : '/api';

export function initAlerts() {
  setupSendAlertButton();
  fetchAndRenderAlertHistory();
}

function setupSendAlertButton() {
  // Dedicated tab button first (SMS Alerts Command Center)
  const tabBtn = document.getElementById('smsTabSendBtn');
  if (tabBtn) {
    tabBtn.addEventListener('click', openSmsModal);
    return;
  }

  const alertBanner = document.querySelector('.alert-banner');
  if (!alertBanner) return;

  // Fallback: in-banner button when the tab layout isn't present
  let sendSmsBtn = alertBanner.querySelector('#sendSmsAlertBtn');
  if (!sendSmsBtn) {
    sendSmsBtn = document.createElement('button');
    sendSmsBtn.id = 'sendSmsAlertBtn';
    sendSmsBtn.className = 'btn-danger-glow';
    sendSmsBtn.innerHTML = '📲 Send Alert Now (SMS)';
    alertBanner.appendChild(sendSmsBtn);
  }

  sendSmsBtn.addEventListener('click', openSmsModal);
}

async function openSmsModal() {
  let contacts = [];
  let gatewayStatus = { provider: 'MOCK', isMock: true, status: 'SIMULATION_MODE' };

  try {
    const cRes = await fetch(`${API_BASE}/contacts`);
    if (cRes.ok) contacts = await cRes.json();

    const gRes = await fetch(`${API_BASE}/alerts/gateway-status`);
    if (gRes.ok) gatewayStatus = await gRes.json();
  } catch (e) {}

  if (contacts.length === 0) {
    contacts = [
      { id: 'c1', name: 'Disaster Control Room', phone: '+919876543210', district: 'Guwahati' },
      { id: 'c2', name: 'State Emergency Center', phone: '+919876543211', district: 'Shillong' }
    ];
  }

  // Remove existing modal if any
  const oldModal = document.getElementById('smsModalOverlay');
  if (oldModal) oldModal.remove();

  const providerLabel = gatewayStatus.isMock
    ? '⚠️ Simulation Mode (Demo)'
    : `🟢 Gateway: ${gatewayStatus.provider}`;

  const modalHtml = `
    <div id="smsModalOverlay" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3>📲 Trigger Early Warning SMS Broadcast</h3>
            <span class="gateway-badge ${gatewayStatus.isMock ? 'badge-sim' : 'badge-live'}">${providerLabel}</span>
          </div>
          <button class="modal-close" id="closeSmsModal">✕</button>
        </div>
        
        <div class="modal-body">
          ${gatewayStatus.isMock ? `
            <div style="background:rgba(230, 180, 50, 0.1); border:1px solid rgba(230, 180, 50, 0.3); border-radius:6px; padding:8px 12px; font-size:0.8rem; color:#f0c050;">
              ℹ️ System is currently in Simulation Mode. To send real SMS to mobile phones, configure Fast2SMS / Twilio in the <strong>System Settings</strong> panel below.
            </div>
          ` : ''}

          <div class="form-group">
            <label>Emergency Message Template</label>
            <textarea id="smsMessageText" rows="4" class="modal-input">ALERT [ARAVINDHA]: High risk of severe landslide detected in Eastern Himalayas corridor. Citizens and emergency response teams are advised to exercise extreme caution.</textarea>
          </div>

          <div class="form-group">
            <label>Select Recipients (${contacts.length} registered contacts)</label>
            <div class="recipient-checklist">
              ${contacts.map(c => `
                <label class="checkbox-row">
                  <input type="checkbox" class="sms-recipient-cb" value="${c.phone}" checked>
                  <span><strong>${c.name}</strong> (${c.district}) — <code>${c.phone}</code></span>
                </label>
              `).join('')}
            </div>
          </div>

          <div id="smsStatusReport" class="status-report-box" style="display:none;"></div>
        </div>

        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
          <button class="btn-whatsapp" id="sendWhatsAppBtn" style="background:#25D366; color:#000; font-weight:700; border:none; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            💬 Send via WhatsApp (Free)
          </button>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="cancelSmsBtn">Cancel</button>
            <button class="btn-primary-danger" id="confirmSmsBtn">Confirm & Send SMS Now 🚀</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('closeSmsModal').onclick = () => document.getElementById('smsModalOverlay').remove();
  document.getElementById('cancelSmsBtn').onclick = () => document.getElementById('smsModalOverlay').remove();

  // WhatsApp Free One-Click Dispatch Handler
  document.getElementById('sendWhatsAppBtn').onclick = () => {
    const message = document.getElementById('smsMessageText').value;
    const checkedBoxes = document.querySelectorAll('.sms-recipient-cb:checked');
    const recipients = Array.from(checkedBoxes).map(cb => cb.value);

    if (recipients.length === 0) {
      alert('Please select at least one recipient phone number.');
      return;
    }

    // Open WhatsApp Web for the selected recipients
    recipients.forEach((phone, idx) => {
      const cleanDigits = phone.replace(/\D/g, '');
      const fullDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
      const waUrl = `https://api.whatsapp.com/send?phone=${fullDigits}&text=${encodeURIComponent(message)}`;
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, idx * 600);
    });

    const reportBox = document.getElementById('smsStatusReport');
    reportBox.style.display = 'block';
    reportBox.className = 'status-report-box status-success';
    reportBox.innerHTML = `<strong>💬 WhatsApp Dispatch Launched!</strong><br>Opening WhatsApp conversation with pre-filled alert message for ${recipients.length} contact(s).`;
  };

  document.getElementById('confirmSmsBtn').onclick = async () => {
    const message = document.getElementById('smsMessageText').value;
    const checkedBoxes = document.querySelectorAll('.sms-recipient-cb:checked');
    const recipients = Array.from(checkedBoxes).map(cb => cb.value);

    if (recipients.length === 0) {
      alert('Please select at least one recipient phone number.');
      return;
    }

    const reportBox = document.getElementById('smsStatusReport');
    reportBox.style.display = 'block';
    reportBox.className = 'status-report-box';
    reportBox.innerHTML = '⏳ Dispathing SMS broadcast through gateway...';

    try {
      const res = await fetch(`${API_BASE}/alerts/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message })
      });
      const data = await res.json();

      if (res.ok && data.deliverySummary) {
        const summary = data.deliverySummary;
        const isSuccess = summary.deliveredCount > 0;
        
        reportBox.className = `status-report-box ${isSuccess ? 'status-success' : 'status-error'}`;
        reportBox.innerHTML = `
          <strong>${isSuccess ? '✅ SMS Broadcast Dispatched!' : '❌ SMS Broadcast Failed'}</strong>
          <div>Gateway: <strong>${summary.provider}</strong> | Delivered: <strong>${summary.deliveredCount}/${summary.totalSent}</strong></div>
          ${summary.isSimulation ? `<small style="color:var(--yellow); display:block; margin-top:4px;">⚠️ Simulation Mode: Logged in console. Configure Gateway in Settings for physical delivery.</small>` : ''}
          <div style="margin-top:6px; font-size:0.75rem; max-height:80px; overflow-y:auto;">
            ${summary.statuses.map(s => `
              <div>• ${s.phone}: <span style="color:${s.status.includes('DELIVERED') ? 'var(--green)' : 'var(--red)'}">${s.status}</span> ${s.error ? `(${s.error})` : ''}</div>
            `).join('')}
          </div>
        `;
        fetchAndRenderAlertHistory();
        if (isSuccess) {
          setTimeout(() => document.getElementById('smsModalOverlay')?.remove(), 4000);
        }
      } else {
        reportBox.className = 'status-report-box status-error';
        reportBox.innerHTML = `❌ Send failed: ${data.error || 'Server error'}`;
      }
    } catch (err) {
      reportBox.className = 'status-report-box status-error';
      reportBox.innerHTML = `❌ Connection error: ${err.message}`;
    }
  };
}

export async function fetchAndRenderAlertHistory() {
  try {
    const res = await fetch(`${API_BASE}/alerts/history`);
    if (!res.ok) return;
    const logs = await res.json();
    renderAlertLogTable(logs);
  } catch (err) {
    console.warn('[Alerts Module] Unable to fetch alert history:', err.message);
  }
}

function renderAlertLogTable(logs) {
  // Dedicated SMS Alerts tab container first; overview fallback otherwise.
  const tabContainer = document.getElementById('sms-audit-container');
  let auditBox;
  if (tabContainer) {
    auditBox = document.getElementById('alertAuditSection');
    if (!auditBox) {
      auditBox = document.createElement('div');
      auditBox.id = 'alertAuditSection';
      auditBox.className = 'panel alert-audit-panel';
      tabContainer.appendChild(auditBox);
    }
  } else {
    const alertBanner = document.querySelector('.alert-banner');
    if (!alertBanner) return;

    auditBox = document.getElementById('alertAuditSection');
    if (!auditBox) {
      auditBox = document.createElement('div');
      auditBox.id = 'alertAuditSection';
      auditBox.className = 'panel alert-audit-panel';
      auditBox.style.marginTop = '20px';
      alertBanner.parentNode.insertBefore(auditBox, alertBanner.nextSibling);
    }
  }

  if (!logs || logs.length === 0) {
    auditBox.innerHTML = `
      <div class="panel-header">
        <h3>EARLY WARNING SMS AUDIT TRAIL</h3>
      </div>
      <p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">No alerts triggered yet. Click "Send Alert Now" above to trigger warnings.</p>
    `;
    return;
  }

  auditBox.innerHTML = `
    <div class="panel-header" style="margin-bottom:12px;">
      <h3>⚡ EARLY WARNING SMS AUDIT LOG</h3>
      <small style="color:var(--accent-cyan);">${logs.length} logged broadcasts</small>
    </div>
    <div class="table-responsive">
      <table class="audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Message</th>
            <th>Recipients</th>
            <th>Delivery Status</th>
          </tr>
        </thead>
        <tbody>
          ${logs.slice(0, 10).map(l => `
            <tr>
              <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
              <td><span class="badge ${l.trigger_type === 'MANUAL' ? 'badge-manual' : 'badge-auto'}">${l.trigger_type}</span></td>
              <td><div class="msg-truncate">${l.message}</div></td>
              <td>${Array.isArray(l.recipients) ? l.recipients.length : 1} contact(s)</td>
              <td><strong style="color:${l.status.includes('FAIL') ? 'var(--red)' : 'var(--accent-cyan)'};">${l.status}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
