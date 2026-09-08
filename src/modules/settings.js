/**
 * ARAVINDHA Dashboard — Settings & Contact Management Module
 * SMS Gateway Configuration, Instant Gateway Tester & Recipient Directory
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:4000/api'
  : '/api';

export function initSettings() {
  setupSettingsUI();
}

export async function setupSettingsUI() {
  let settingsSection = document.querySelector('.settings-panel');
  
  if (!settingsSection) {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    settingsSection = document.createElement('section');
    settingsSection.className = 'panel settings-panel';
    settingsSection.style.marginTop = '20px';
    mainContent.appendChild(settingsSection);
  }

  fetchAndRenderSettings(settingsSection);
}

async function fetchAndRenderSettings(container) {
  let contacts = [];
  let settings = {
    auto_sms_severe: 'false',
    sms_provider: 'MOCK',
    fast2sms_api_key: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
    msg91_auth_key: '',
    msg91_flow_id: '',
    msg91_sender_id: 'ARAVIN',
    textlocal_api_key: '',
    textlocal_sender: 'TXTLCL',
    textbelt_api_key: '1a75c4bcd41424ec606937120cfa0b667afce79bS06jvxv5FsG7IMQz4xChYMPtU',
    custom_webhook_url: '',
    custom_webhook_auth: ''
  };

  try {
    const cRes = await fetch(`${API_BASE}/contacts`);
    if (cRes.ok) contacts = await cRes.json();

    const sRes = await fetch(`${API_BASE}/settings`);
    if (sRes.ok) {
      const dbSettings = await sRes.json();
      settings = { ...settings, ...dbSettings };
    }
  } catch (err) {
    console.warn('[Settings Module] Backend offline fallback:', err.message);
  }

  const activeProvider = (settings.sms_provider || 'MOCK').toUpperCase();

  container.innerHTML = `
    <div class="panel-header" style="margin-bottom: 16px;">
      <div>
        <div class="panel-kicker">CONFIGURATION</div>
        <h2>System Settings & Recipient Directory</h2>
      </div>
      <div class="gateway-status-pill ${activeProvider === 'MOCK' ? 'pill-warning' : 'pill-success'}">
        ${activeProvider === 'MOCK' ? '⚠️ Simulation Mode (No Real SMS)' : `🟢 Active: ${activeProvider}`}
      </div>
    </div>

    <div class="settings-grid">
      <!-- Automated Rules -->
      <div class="settings-card">
        <h3>⚡ Automated Warning Rules</h3>
        <div class="toggle-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0;">
          <div>
            <strong>Auto-SMS on SEVERE Risk Level</strong>
            <p style="color:var(--text-muted); font-size:0.85rem;">Automatically dispatch SMS alerts to emergency contacts when ML model predicts SEVERE hazard (score >= 75).</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="autoSmsToggle" ${settings.auto_sms_severe === 'true' ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <!-- SMS Gateway Provider Configuration Card -->
      <div class="settings-card" id="smsGatewayCard">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>📡 Real-Time SMS Gateway Configuration</h3>
          <span style="font-size:0.75rem; color:var(--text-muted);">Required for real phone delivery</span>
        </div>

        <div class="gateway-info-banner" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:14px; font-size:0.85rem;">
          <p style="margin:0 0 6px 0;"><strong>Active Cellular SMS Gateway:</strong></p>
          <p style="margin:0; color:var(--text-muted);">Selected provider delivers real carrier alerts over GSM/cellular networks. <strong>Textbelt</strong> is configured with your API key for automated global SMS.</p>
        </div>

        <form id="smsGatewayForm">
          <div class="form-group" style="margin-bottom:12px;">
            <label style="display:block; margin-bottom:6px; font-size:0.85rem; font-weight:600;">Active SMS Provider</label>
            <select id="smsProviderSelect" class="input-sm" style="width:100%; height:38px;">
              <option value="TEXTBELT" ${activeProvider === 'TEXTBELT' ? 'selected' : ''}>📨 Textbelt (Automated Global Cellular SMS)</option>
              <option value="WHATSAPP" ${activeProvider === 'WHATSAPP' ? 'selected' : ''}>💬 WhatsApp (Free Direct Alerts via CallMeBot)</option>
              <option value="FAST2SMS" ${activeProvider === 'FAST2SMS' ? 'selected' : ''}>🚀 Fast2SMS (India Cellular SMS — Requires ₹100 Top-up)</option>
              <option value="TWILIO" ${activeProvider === 'TWILIO' ? 'selected' : ''}>🌐 Twilio (Global SMS Gateway)</option>
              <option value="MSG91" ${activeProvider === 'MSG91' ? 'selected' : ''}>✉️ MSG91 (Flow & Transactional)</option>
              <option value="TEXTLOCAL" ${activeProvider === 'TEXTLOCAL' ? 'selected' : ''}>📱 Textlocal (India)</option>
              <option value="CUSTOM_WEBHOOK" ${activeProvider === 'CUSTOM_WEBHOOK' ? 'selected' : ''}>🔗 Custom Webhook / GSM Modem</option>
              <option value="MOCK" ${activeProvider === 'MOCK' ? 'selected' : ''}>🖥️ Console Simulation (Demo Mode Only)</option>
            </select>
          </div>

          <!-- Dynamic Provider Fields -->
          <!-- Textbelt Fields -->
          <div id="fieldsTextbelt" class="provider-fields" style="display:${activeProvider === 'TEXTBELT' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom:12px;">
              <label style="display:block; margin-bottom:6px; font-size:0.85rem; font-weight:600;">Textbelt API Key</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="textbeltApiKey" value="${settings.textbelt_api_key || '1a75c4bcd41424ec606937120cfa0b667afce79bS06jvxv5FsG7IMQz4xChYMPtU'}" placeholder="Enter Textbelt API Key" class="input-sm" style="flex:1;">
                <button type="button" id="btnCheckTextbeltQuota" class="btn-secondary" style="white-space:nowrap; padding:4px 12px; font-size:0.8rem; border-color:var(--accent-cyan); color:var(--accent-cyan);">📊 Check Live Quota</button>
              </div>
              <div id="textbeltQuotaStatus" style="margin-top:8px; font-size:0.82rem; display:none; padding:8px 12px; border-radius:6px;"></div>
              <div style="background:rgba(0, 229, 255, 0.07); border:1px solid rgba(0, 229, 255, 0.25); border-radius:6px; padding:10px; margin-top:8px; font-size:0.8rem; color:var(--text-main);">
                <strong>⚡ Textbelt Automated Global SMS:</strong> Sends direct carrier SMS worldwide to any mobile number (E.164 format, e.g., <code>+919342036881</code>).<br>
                <div style="margin-top:4px;">Need to top up credits? <a href="https://textbelt.com/purchase?key=${encodeURIComponent(settings.textbelt_api_key || '1a75c4bcd41424ec606937120cfa0b667afce79bS06jvxv5FsG7IMQz4xChYMPtU')}" target="_blank" style="color:var(--accent-cyan); text-decoration:underline; font-weight:bold;">Refill Textbelt SMS credits here &rarr;</a></div>
              </div>
            </div>
          </div>

          <!-- WhatsApp Fields -->
          <div id="fieldsWhatsapp" class="provider-fields" style="display:${activeProvider === 'WHATSAPP' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom:12px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">CallMeBot Free WhatsApp API Key</label>
              <input type="password" id="whatsappApiKey" value="${settings.whatsapp_api_key || ''}" placeholder="Enter your CallMeBot API Key" class="input-sm" style="width:100%;">
              <div style="background:rgba(37, 211, 102, 0.1); border:1px solid rgba(37, 211, 102, 0.3); border-radius:6px; padding:10px; margin-top:8px; font-size:0.8rem; color:#25D366;">
                <strong>📲 How to get your free WhatsApp API Key in 10 seconds:</strong><br>
                1. Open WhatsApp on your phone and send message: <code>I allow callmebot to send me messages</code> to <strong>+34 941 86 00 24</strong><br>
                2. CallMeBot will reply immediately with your personal API Key.<br>
                3. Paste that API Key here and click <strong>Save</strong>!
              </div>
            </div>
          </div>

          <!-- Fast2SMS Fields -->
          <div id="fieldsFast2sms" class="provider-fields" style="display:${activeProvider === 'FAST2SMS' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom:12px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Fast2SMS API Authorization Key</label>
              <input type="password" id="fast2smsApiKey" value="${settings.fast2sms_api_key || ''}" placeholder="Paste your Fast2SMS API Key" class="input-sm" style="width:100%;">
              <small style="color:var(--text-muted); font-size:0.75rem;">Get a free API key instantly with free credits at <a href="https://www.fast2sms.com" target="_blank" style="color:var(--accent-cyan); text-decoration:underline;">fast2sms.com</a></small>
            </div>
          </div>

          <!-- Twilio Fields -->
          <div id="fieldsTwilio" class="provider-fields" style="display:${activeProvider === 'TWILIO' ? 'block' : 'none'};">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
              <div class="form-group">
                <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Twilio Account SID</label>
                <input type="text" id="twilioAccountSid" value="${settings.twilio_account_sid || ''}" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx" class="input-sm" style="width:100%;">
              </div>
              <div class="form-group">
                <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Twilio Auth Token</label>
                <input type="password" id="twilioAuthToken" value="${settings.twilio_auth_token || ''}" placeholder="Auth Token" class="input-sm" style="width:100%;">
              </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Twilio From Phone Number</label>
              <input type="text" id="twilioFromNumber" value="${settings.twilio_from_number || ''}" placeholder="+18005550199" class="input-sm" style="width:100%;">
              <small style="color:var(--text-muted); font-size:0.75rem;">Twilio trial accounts require recipient numbers (+91...) to be verified in Twilio Console.</small>
            </div>
          </div>

          <!-- MSG91 Fields -->
          <div id="fieldsMsg91" class="provider-fields" style="display:${activeProvider === 'MSG91' ? 'block' : 'none'};">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
              <div class="form-group">
                <label style="display:block; margin-bottom:4px; font-size:0.85rem;">MSG91 Auth Key</label>
                <input type="password" id="msg91AuthKey" value="${settings.msg91_auth_key || ''}" placeholder="Auth Key" class="input-sm" style="width:100%;">
              </div>
              <div class="form-group">
                <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Sender ID / Flow ID</label>
                <input type="text" id="msg91SenderId" value="${settings.msg91_sender_id || 'ARAVIN'}" placeholder="ARAVIN" class="input-sm" style="width:100%;">
              </div>
            </div>
          </div>

          <!-- Textlocal Fields -->
          <div id="fieldsTextlocal" class="provider-fields" style="display:${activeProvider === 'TEXTLOCAL' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom:10px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Textlocal API Key</label>
              <input type="password" id="textlocalApiKey" value="${settings.textlocal_api_key || ''}" placeholder="API Key" class="input-sm" style="width:100%;">
            </div>
          </div>

          <!-- Custom Webhook Fields -->
          <div id="fieldsWebhook" class="provider-fields" style="display:${activeProvider === 'CUSTOM_WEBHOOK' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom:10px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Custom Webhook POST URL</label>
              <input type="url" id="customWebhookUrl" value="${settings.custom_webhook_url || ''}" placeholder="https://api.your-sms-modem.com/send" class="input-sm" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
              <label style="display:block; margin-bottom:4px; font-size:0.85rem;">Authorization Header (Optional)</label>
              <input type="text" id="customWebhookAuth" value="${settings.custom_webhook_auth || ''}" placeholder="Bearer your-token-here" class="input-sm" style="width:100%;">
            </div>
          </div>

          <!-- Save Button -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
            <button type="submit" class="btn-sm-primary" id="saveGatewayBtn" style="padding:8px 16px;">💾 Save Gateway Settings</button>
            <span id="gatewaySaveStatus" style="font-size:0.8rem; color:var(--green); display:none;">Saved successfully!</span>
          </div>
        </form>

        <!-- Live Instant SMS Tester -->
        <div class="sms-tester-box" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px;">
          <h4 style="margin:0 0 8px 0; font-size:0.9rem;">🧪 Instant SMS Delivery Diagnostic Tester</h4>
          <p style="color:var(--text-muted); font-size:0.8rem; margin:0 0 10px 0;">Send a real test SMS right now to verify that your configured gateway successfully connects and delivers to your mobile number.</p>
          
          <div style="display:flex; gap:8px;">
            <input type="text" id="testSmsPhone" placeholder="Enter mobile number (e.g. +919342036881)" value="${contacts[0]?.phone || ''}" class="input-sm" style="flex:1;">
            <button type="button" id="btnTestSms" class="btn-secondary" style="white-space:nowrap; border-color:var(--accent-cyan); color:var(--accent-cyan);">🚀 Send Test SMS</button>
          </div>

          <div id="testSmsResult" style="display:none; margin-top:12px; padding:10px 14px; border-radius:8px; font-size:0.85rem;"></div>
        </div>
      </div>

      <!-- Recipient Directory -->
      <div class="settings-card">
        <h3>📱 Emergency SMS Recipients</h3>
        
        <form id="addContactForm" class="contact-form" style="display:flex; gap:10px; margin-bottom:16px;">
          <input type="text" id="contactName" placeholder="Contact / Office Name" required class="input-sm">
          <input type="text" id="contactPhone" placeholder="Phone (+91...)" required class="input-sm">
          <input type="text" id="contactDistrict" placeholder="District/Region" required class="input-sm">
          <button type="submit" class="btn-sm-primary">+ Add Contact</button>
        </form>

        <div class="contacts-table-wrapper">
          <table class="audit-table">
            <thead>
              <tr>
                <th>Name / Role</th>
                <th>Phone Number</th>
                <th>District / Region</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${contacts.length === 0 ? `
                <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No registered contacts. Add one above.</td></tr>
              ` : contacts.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td><code>${c.phone}</code></td>
                  <td>${c.district}</td>
                  <td>
                    <button class="btn-delete-contact" data-id="${c.id}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach Provider Selector Change
  const providerSelect = container.querySelector('#smsProviderSelect');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      container.querySelectorAll('.provider-fields').forEach(f => f.style.display = 'none');
      if (selected === 'TEXTBELT') container.querySelector('#fieldsTextbelt').style.display = 'block';
      if (selected === 'WHATSAPP') container.querySelector('#fieldsWhatsapp').style.display = 'block';
      if (selected === 'FAST2SMS') container.querySelector('#fieldsFast2sms').style.display = 'block';
      if (selected === 'TWILIO') container.querySelector('#fieldsTwilio').style.display = 'block';
      if (selected === 'MSG91') container.querySelector('#fieldsMsg91').style.display = 'block';
      if (selected === 'TEXTLOCAL') container.querySelector('#fieldsTextlocal').style.display = 'block';
      if (selected === 'CUSTOM_WEBHOOK') container.querySelector('#fieldsWebhook').style.display = 'block';
    });
  }

  // Attach Textbelt Quota Checker
  const btnQuota = container.querySelector('#btnCheckTextbeltQuota');
  if (btnQuota) {
    btnQuota.addEventListener('click', async () => {
      const quotaBox = container.querySelector('#textbeltQuotaStatus');
      const apiKey = (container.querySelector('#textbeltApiKey')?.value || '').trim();
      quotaBox.style.display = 'block';
      quotaBox.style.background = 'var(--surface-2)';
      quotaBox.style.color = 'var(--text-main)';
      quotaBox.innerHTML = '⏳ Querying live quota from Textbelt...';

      try {
        const res = await fetch(`${API_BASE}/alerts/textbelt-quota?key=${encodeURIComponent(apiKey)}`);
        const data = await res.json();
        if (data.success) {
          const quota = data.quotaRemaining ?? 0;
          if (quota > 0) {
            quotaBox.style.background = 'rgba(16, 185, 129, 0.15)';
            quotaBox.style.border = '1px solid var(--green)';
            quotaBox.style.color = '#34d399';
            quotaBox.innerHTML = `🟢 <strong>Quota Active:</strong> <strong>${quota}</strong> SMS text credits available.`;
          } else {
            quotaBox.style.background = 'rgba(239, 68, 68, 0.15)';
            quotaBox.style.border = '1px solid var(--red)';
            quotaBox.style.color = '#f87171';
            quotaBox.innerHTML = `⚠️ <strong>0 SMS Credits Remaining:</strong> Key is valid, but credits are exhausted.<br><a href="https://textbelt.com/purchase?key=${encodeURIComponent(apiKey)}" target="_blank" style="color:#00e5ff; text-decoration:underline; font-weight:bold; display:inline-block; margin-top:4px;">&rarr; Purchase / Refill Textbelt Credits</a>`;
          }
        } else {
          quotaBox.style.background = 'rgba(239, 68, 68, 0.15)';
          quotaBox.style.border = '1px solid var(--red)';
          quotaBox.style.color = '#f87171';
          quotaBox.innerHTML = `❌ ${data.error || 'Failed to check quota'}`;
        }
      } catch (err) {
        quotaBox.style.background = 'rgba(239, 68, 68, 0.15)';
        quotaBox.style.border = '1px solid var(--red)';
        quotaBox.style.color = '#f87171';
        quotaBox.innerHTML = `❌ Error: ${err.message}`;
      }
    });
  }

  // Attach Gateway Settings Save
  const gatewayForm = container.querySelector('#smsGatewayForm');
  if (gatewayForm) {
    gatewayForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveStatus = container.querySelector('#gatewaySaveStatus');
      const saveBtn = container.querySelector('#saveGatewayBtn');

      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      const payload = {
        settings: {
          sms_provider: container.querySelector('#smsProviderSelect').value,
          textbelt_api_key: container.querySelector('#textbeltApiKey')?.value || '',
          whatsapp_api_key: container.querySelector('#whatsappApiKey')?.value || '',
          fast2sms_api_key: container.querySelector('#fast2smsApiKey')?.value || '',
          twilio_account_sid: container.querySelector('#twilioAccountSid')?.value || '',
          twilio_auth_token: container.querySelector('#twilioAuthToken')?.value || '',
          twilio_from_number: container.querySelector('#twilioFromNumber')?.value || '',
          msg91_auth_key: container.querySelector('#msg91AuthKey')?.value || '',
          msg91_sender_id: container.querySelector('#msg91SenderId')?.value || '',
          textlocal_api_key: container.querySelector('#textlocalApiKey')?.value || '',
          custom_webhook_url: container.querySelector('#customWebhookUrl')?.value || '',
          custom_webhook_auth: container.querySelector('#customWebhookAuth')?.value || ''
        }
      };

      try {
        const res = await fetch(`${API_BASE}/settings/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          saveStatus.style.display = 'inline';
          saveStatus.innerText = '✅ Settings saved!';
          setTimeout(() => {
            fetchAndRenderSettings(container);
          }, 1000);
        } else {
          saveStatus.style.display = 'inline';
          saveStatus.style.color = 'var(--red)';
          saveStatus.innerText = '❌ Failed to save';
        }
      } catch (err) {
        saveStatus.style.display = 'inline';
        saveStatus.style.color = 'var(--red)';
        saveStatus.innerText = `❌ Error: ${err.message}`;
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Save Gateway Settings';
      }
    });
  }

  // Attach Test SMS Trigger
  const testBtn = container.querySelector('#btnTestSms');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const phoneInput = container.querySelector('#testSmsPhone');
      const resultBox = container.querySelector('#testSmsResult');
      const phone = phoneInput.value.trim();

      if (!phone) {
        alert('Please enter a valid phone number for the test SMS.');
        return;
      }

      resultBox.style.display = 'block';
      resultBox.className = 'status-report-box';
      resultBox.style.background = 'var(--surface-2)';
      resultBox.style.border = '1px solid var(--border)';
      resultBox.innerHTML = `⏳ Dispatching test SMS to <strong>${phone}</strong>...`;
      testBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/alerts/test-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const status = data.summary?.statuses?.[0] || {};
          resultBox.className = 'status-report-box status-success';
          resultBox.innerHTML = `
            <div><strong>✅ Test SMS Dispatched Successfully!</strong></div>
            <div style="margin-top:4px;">Provider: <strong>${data.summary.provider}</strong> | Details: ${status.details || status.status}</div>
            ${status.messageId ? `<small style="color:var(--text-muted);">Message ID: ${status.messageId}</small>` : ''}
            ${data.summary.isSimulation ? `<div style="color:var(--yellow); font-size:0.75rem; margin-top:4px;">⚠️ Note: Running in Simulation mode. Configure Fast2SMS / Twilio above for physical cellular delivery.</div>` : ''}
          `;
        } else {
          const status = data.summary?.statuses?.[0] || {};
          resultBox.className = 'status-report-box status-error';
          resultBox.innerHTML = `
            <div><strong>❌ Test SMS Delivery Failed</strong></div>
            <div style="margin-top:4px;">Provider: <strong>${data.summary?.provider || 'Unknown'}</strong></div>
            <div style="margin-top:4px; color:var(--red);">${status.error || data.error || data.details || 'Check API credentials'}</div>
          `;
        }
      } catch (err) {
        resultBox.className = 'status-report-box status-error';
        resultBox.innerHTML = `<strong>❌ Connection Error:</strong> ${err.message}`;
      } finally {
        testBtn.disabled = false;
      }
    });
  }

  // Attach auto-SMS toggle handler
  const toggle = container.querySelector('#autoSmsToggle');
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      try {
        await fetch(`${API_BASE}/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'auto_sms_severe', value: isChecked ? 'true' : 'false' })
        });
      } catch (err) {
        console.warn('Failed to update auto-SMS setting:', err.message);
      }
    });
  }

  // Attach Add Contact form submit handler
  const form = container.querySelector('#addContactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#contactName').value;
      const phone = container.querySelector('#contactPhone').value;
      const district = container.querySelector('#contactDistrict').value;

      try {
        const res = await fetch(`${API_BASE}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, district })
        });
        if (res.ok) {
          fetchAndRenderSettings(container);
        }
      } catch (err) {
        alert('Failed to add contact: ' + err.message);
      }
    });
  }

  // Attach Delete handlers
  container.querySelectorAll('.btn-delete-contact').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (confirm('Delete this contact from emergency broadcast list?')) {
        try {
          await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE' });
          fetchAndRenderSettings(container);
        } catch (err) {
          console.warn('Failed to delete contact:', err.message);
        }
      }
    });
  });
}
