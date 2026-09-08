/**
 * SMS & WhatsApp Gateway Abstraction Service for ARAVINDHA Early Warning System
 * Supports WhatsApp (CallMeBot & WhatsApp Web Direct), Fast2SMS (India), Twilio (Global), MSG91, Textlocal, Custom Webhook, and Simulation.
 */

import { queryAll } from '../db/database.js';

// Helper to get configuration combining DB settings and process.env
export async function getGatewayConfig() {
  let dbSettings = {};
  try {
    const rows = await queryAll('SELECT key, value FROM settings');
    rows.forEach(r => { dbSettings[r.key] = r.value; });
  } catch (e) {
    // If DB not ready yet, use env only
  }

  const provider = (dbSettings.sms_provider || process.env.SMS_PROVIDER || 'MOCK').toUpperCase();

  return {
    provider,
    isMock: provider === 'MOCK',
    // WhatsApp (CallMeBot)
    whatsappApiKey: dbSettings.whatsapp_api_key || process.env.WHATSAPP_API_KEY || '',
    // Fast2SMS (India)
    fast2smsApiKey: dbSettings.fast2sms_api_key || process.env.FAST2SMS_API_KEY || '',
    // Twilio
    twilioAccountSid: dbSettings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: dbSettings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '',
    twilioFromNumber: dbSettings.twilio_from_number || process.env.TWILIO_FROM_NUMBER || '',
    // MSG91
    msg91AuthKey: dbSettings.msg91_auth_key || process.env.MSG91_AUTH_KEY || '',
    msg91FlowId: dbSettings.msg91_flow_id || process.env.MSG91_FLOW_ID || '',
    msg91SenderId: dbSettings.msg91_sender_id || process.env.MSG91_SENDER_ID || 'ARAVIN',
    // Textlocal
    textlocalApiKey: dbSettings.textlocal_api_key || process.env.TEXTLOCAL_API_KEY || '',
    textlocalSender: dbSettings.textlocal_sender || process.env.TEXTLOCAL_SENDER || 'TXTLCL',
    // Textbelt (Automated Global SMS)
    textbeltApiKey: dbSettings.textbelt_api_key || process.env.TEXTBELT_API_KEY || '1a75c4bcd41424ec606937120cfa0b667afce79bS06jvxv5FsG7IMQz4xChYMPtU',
    // Custom Webhook
    customWebhookUrl: dbSettings.custom_webhook_url || process.env.CUSTOM_WEBHOOK_URL || '',
    customWebhookAuth: dbSettings.custom_webhook_auth || process.env.CUSTOM_WEBHOOK_AUTH || ''
  };
}

// Clean phone number for India (10 digits)
function cleanIndianPhoneNumber(phone) {
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return digits;
}

// Format phone number for E.164
function formatE164(phone) {
  let cleaned = String(phone).trim();
  if (!cleaned.startsWith('+')) {
    let digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) {
      cleaned = '+91' + digits; // Default to India prefix if 10 digits
    } else {
      cleaned = '+' + digits;
    }
  }
  return cleaned;
}

export async function sendSms(toNumbers, messageText, configOverride = null) {
  const config = configOverride ? { ...(await getGatewayConfig()), ...configOverride } : await getGatewayConfig();
  const provider = (config.provider || 'MOCK').toUpperCase();
  const deliveryStatuses = [];

  console.log(`[Alert Gateway] Initiating broadcast via [${provider}] to ${toNumbers.length} recipients...`);

  // Provider: WhatsApp via CallMeBot (Free WhatsApp API)
  if (provider === 'WHATSAPP' || provider === 'WHATSAPP_CALLMEBOT') {
    if (!config.whatsappApiKey) {
      return {
        provider: 'WHATSAPP',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'WhatsApp API Key (CallMeBot) missing in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'WHATSAPP',
          error: 'WhatsApp API Key missing. Please configure in Settings.'
        }))
      };
    }

    for (const phone of toNumbers) {
      const e164 = formatE164(phone);
      try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(e164)}&text=${encodeURIComponent(messageText)}&apikey=${config.whatsappApiKey.trim()}`;
        const res = await fetch(url);
        const text = await res.text();
        const isSuccess = res.ok && (text.includes('Message Queued') || text.includes('Message sent') || text.includes('success'));

        deliveryStatuses.push({
          phone,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          provider: 'WHATSAPP',
          details: isSuccess ? 'Delivered to WhatsApp directly' : text,
          error: isSuccess ? null : text
        });
      } catch (err) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'WHATSAPP',
          error: `WhatsApp connection error: ${err.message}`
        });
      }
    }
  }

  // Provider: Fast2SMS (India Quick SMS API)
  else if (provider === 'FAST2SMS') {
    if (!config.fast2smsApiKey) {
      return {
        provider: 'FAST2SMS',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'Fast2SMS API Key is missing. Please enter your Fast2SMS API Key in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'FAST2SMS',
          error: 'Fast2SMS API Key not configured in Settings.'
        }))
      };
    }

    const valid10DigitNumbers = [];
    const invalidNumbers = [];

    for (const phone of toNumbers) {
      const cleaned = cleanIndianPhoneNumber(phone);
      if (cleaned.length === 10) {
        valid10DigitNumbers.push({ original: phone, cleaned });
      } else {
        invalidNumbers.push({ original: phone, cleaned });
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'FAST2SMS',
          error: `Invalid Indian 10-digit phone number format: "${phone}"`
        });
      }
    }

    if (valid10DigitNumbers.length > 0) {
      try {
        const numbersString = valid10DigitNumbers.map(n => n.cleaned).join(',');
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': config.fast2smsApiKey.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'q',
            message: messageText,
            language: 'english',
            flash: 0,
            numbers: numbersString
          })
        });

        const resData = await response.json();
        const isSuccess = response.ok && (resData.return === true || resData.status_code === 200);
        const errorMsg = Array.isArray(resData.message) ? resData.message.join(', ') : (typeof resData.message === 'string' ? resData.message : JSON.stringify(resData));

        for (const item of valid10DigitNumbers) {
          deliveryStatuses.push({
            phone: item.original,
            status: isSuccess ? 'DELIVERED' : 'FAILED',
            provider: 'FAST2SMS',
            messageId: resData.request_id || null,
            details: isSuccess ? 'Dispatched via Fast2SMS Cellular Gateway' : errorMsg,
            error: isSuccess ? null : errorMsg
          });
        }
      } catch (err) {
        console.error('[Fast2SMS Network Error]', err);
        for (const item of valid10DigitNumbers) {
          deliveryStatuses.push({
            phone: item.original,
            status: 'FAILED',
            provider: 'FAST2SMS',
            error: `Network error reaching Fast2SMS: ${err.message}`
          });
        }
      }
    }
  }

  // Provider: Twilio (Global E.164)
  else if (provider === 'TWILIO') {
    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
      return {
        provider: 'TWILIO',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'Twilio Account SID, Auth Token, or From Number is missing. Please configure in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'TWILIO',
          error: 'Twilio credentials not configured in Settings.'
        }))
      };
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid.trim()}/Messages.json`;
    const auth = Buffer.from(`${config.twilioAccountSid.trim()}:${config.twilioAuthToken.trim()}`).toString('base64');

    for (const phone of toNumbers) {
      const e164Phone = formatE164(phone);
      try {
        const body = new URLSearchParams({
          To: e164Phone,
          From: config.twilioFromNumber.trim(),
          Body: messageText
        });

        const res = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });

        const data = await res.json();
        const isSuccess = res.ok && !data.error_code;

        deliveryStatuses.push({
          phone,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          provider: 'TWILIO',
          messageId: data.sid || null,
          details: isSuccess ? `Delivered via Twilio (SID: ${data.sid})` : (data.message || 'Twilio Error'),
          error: isSuccess ? null : (data.message || `Twilio Error Code: ${data.error_code}`)
        });
      } catch (err) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'TWILIO',
          error: `Twilio network exception: ${err.message}`
        });
      }
    }
  }

  // Provider: MSG91
  else if (provider === 'MSG91') {
    if (!config.msg91AuthKey) {
      return {
        provider: 'MSG91',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'MSG91 Auth Key is missing in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'MSG91',
          error: 'MSG91 Auth Key not configured in Settings.'
        }))
      };
    }

    for (const phone of toNumbers) {
      const cleanPhone = cleanIndianPhoneNumber(phone);
      try {
        const res = await fetch('https://api.msg91.com/api/v5/flow/', {
          method: 'POST',
          headers: {
            'authkey': config.msg91AuthKey.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            flow_id: config.msg91FlowId?.trim() || undefined,
            sender: config.msg91SenderId?.trim() || 'ARAVIN',
            recipients: [{ mobiles: cleanPhone, message: messageText }]
          })
        });
        const resData = await res.json();
        deliveryStatuses.push({
          phone,
          status: res.ok ? 'DELIVERED' : 'FAILED',
          provider: 'MSG91',
          details: res.ok ? 'Sent via MSG91 Flow' : (resData.message || 'MSG91 Error'),
          error: res.ok ? null : (resData.message || 'MSG91 Error')
        });
      } catch (err) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'MSG91',
          error: err.message
        });
      }
    }
  }

  // Provider: Textlocal (India)
  else if (provider === 'TEXTLOCAL') {
    if (!config.textlocalApiKey) {
      return {
        provider: 'TEXTLOCAL',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'Textlocal API Key missing in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'TEXTLOCAL',
          error: 'Textlocal API Key not configured.'
        }))
      };
    }

    const numbers = toNumbers.map(p => cleanIndianPhoneNumber(p)).filter(p => p.length === 10).join(',');
    try {
      const body = new URLSearchParams({
        apikey: config.textlocalApiKey.trim(),
        numbers,
        message: messageText,
        sender: config.textlocalSender?.trim() || 'TXTLCL'
      });
      const res = await fetch('https://api.textlocal.in/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await res.json();
      const isSuccess = data.status === 'success';

      for (const phone of toNumbers) {
        deliveryStatuses.push({
          phone,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          provider: 'TEXTLOCAL',
          details: isSuccess ? 'Dispatched via Textlocal India' : (data.errors?.[0]?.message || 'Textlocal Error'),
          error: isSuccess ? null : (data.errors?.[0]?.message || 'Textlocal Error')
        });
      }
    } catch (err) {
      for (const phone of toNumbers) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'TEXTLOCAL',
          error: err.message
        });
      }
    }
  }

  // Provider: Custom Webhook
  else if (provider === 'CUSTOM_WEBHOOK' || provider === 'WEBHOOK') {
    if (!config.customWebhookUrl) {
      return {
        provider: 'CUSTOM_WEBHOOK',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'Custom Webhook URL is missing in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'CUSTOM_WEBHOOK',
          error: 'Webhook URL not configured.'
        }))
      };
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (config.customWebhookAuth) {
        headers['Authorization'] = config.customWebhookAuth.trim();
      }

      const res = await fetch(config.customWebhookUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipients: toNumbers,
          message: messageText,
          timestamp: new Date().toISOString()
        })
      });

      const isSuccess = res.ok;
      for (const phone of toNumbers) {
        deliveryStatuses.push({
          phone,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          provider: 'CUSTOM_WEBHOOK',
          details: isSuccess ? `Dispatched via Webhook (${res.status})` : `Webhook returned HTTP ${res.status}`,
          error: isSuccess ? null : `HTTP Status ${res.status}`
        });
      }
    } catch (err) {
      for (const phone of toNumbers) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'CUSTOM_WEBHOOK',
          error: `Webhook connection error: ${err.message}`
        });
      }
    }
  }

  // Provider: Textbelt (Automated Global Cellular SMS)
  else if (provider === 'TEXTBELT') {
    if (!config.textbeltApiKey) {
      return {
        provider: 'TEXTBELT',
        totalSent: toNumbers.length,
        deliveredCount: 0,
        failedCount: toNumbers.length,
        isSimulation: false,
        error: 'Textbelt API Key is missing in Settings.',
        statuses: toNumbers.map(phone => ({
          phone,
          status: 'FAILED',
          provider: 'TEXTBELT',
          error: 'Textbelt API Key not configured.'
        }))
      };
    }

    for (const phone of toNumbers) {
      const e164 = formatE164(phone);
      try {
        const res = await fetch('https://textbelt.com/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: e164,
            message: messageText,
            key: config.textbeltApiKey.trim()
          })
        });
        const data = await res.json();
        const isSuccess = data.success === true;

        deliveryStatuses.push({
          phone,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          provider: 'TEXTBELT',
          messageId: data.textId ? String(data.textId) : null,
          details: isSuccess 
            ? `Delivered via Textbelt (Text ID: ${data.textId}, Quota remaining: ${data.quotaRemaining ?? 'N/A'})` 
            : (data.error || 'Textbelt dispatch failed'),
          error: isSuccess ? null : (data.error || 'Textbelt dispatch failed'),
          quotaRemaining: data.quotaRemaining
        });
      } catch (err) {
        deliveryStatuses.push({
          phone,
          status: 'FAILED',
          provider: 'TEXTBELT',
          error: `Textbelt network error: ${err.message}`
        });
      }
    }
  }

  // Provider: MOCK / Console Simulation Fallback
  else {
    console.log(`[Alert SIMULATION] Broadcaster Active | Message: "${messageText}"`);
    for (const phone of toNumbers) {
      console.log(`[Alert SIMULATION] --> Sent to: ${phone}`);
      deliveryStatuses.push({
        phone,
        status: 'DELIVERED (SIMULATED)',
        provider: 'MOCK (SIMULATION)',
        messageId: `SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        details: 'Simulated dispatch (No real network message sent)',
        timestamp: new Date().toISOString()
      });
    }
  }

  const deliveredCount = deliveryStatuses.filter(s => s.status.startsWith('DELIVERED')).length;
  const failedCount = deliveryStatuses.filter(s => s.status === 'FAILED').length;
  const isSimulation = provider === 'MOCK';

  return {
    provider,
    totalSent: toNumbers.length,
    deliveredCount,
    failedCount,
    isSimulation,
    statuses: deliveryStatuses
  };
}

export async function checkTextbeltQuota(apiKey = null) {
  try {
    const key = (apiKey && apiKey.trim()) || (await getGatewayConfig()).textbeltApiKey;
    if (!key) return { success: false, error: 'No Textbelt API key configured.' };
    const res = await fetch(`https://textbelt.com/quota/${encodeURIComponent(key.trim())}`);
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: `Failed to query Textbelt quota: ${err.message}` };
  }
}

