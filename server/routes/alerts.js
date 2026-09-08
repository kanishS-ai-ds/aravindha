import express from 'express';
import { queryExec, queryAll } from '../db/database.js';
import { sendSms, getGatewayConfig, checkTextbeltQuota } from '../services/smsGateway.js';

const router = express.Router();

// GET /api/alerts/gateway-status
router.get('/gateway-status', async (req, res) => {
  try {
    const config = await getGatewayConfig();
    const isConfigured = (
      (config.provider === 'TEXTBELT' && !!config.textbeltApiKey) ||
      (config.provider === 'WHATSAPP' && !!config.whatsappApiKey) ||
      (config.provider === 'FAST2SMS' && !!config.fast2smsApiKey) ||
      (config.provider === 'TWILIO' && !!config.twilioAccountSid && !!config.twilioAuthToken && !!config.twilioFromNumber) ||
      (config.provider === 'MSG91' && !!config.msg91AuthKey) ||
      (config.provider === 'TEXTLOCAL' && !!config.textlocalApiKey) ||
      (config.provider === 'CUSTOM_WEBHOOK' && !!config.customWebhookUrl)
    );

    res.json({
      provider: config.provider,
      isMock: config.isMock,
      isConfigured: isConfigured || config.isMock,
      status: config.isMock ? 'SIMULATION_MODE' : (isConfigured ? 'READY' : 'UNCONFIGURED')
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query gateway status.' });
  }
});

// GET /api/alerts/textbelt-quota
router.get('/textbelt-quota', async (req, res) => {
  try {
    const key = req.query.key;
    const result = await checkTextbeltQuota(key);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// POST /api/alerts/test-sms (Instant Gateway Diagnostics Test)
router.post('/test-sms', async (req, res) => {
  try {
    const { phone, message, configOverride } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required for test SMS.' });
    }

    const testMsg = message || `[ARAVINDHA TEST] Disaster Early Warning Gateway Verification at ${new Date().toLocaleTimeString()}`;
    const result = await sendSms([phone], testMsg, configOverride);

    res.json({
      success: result.deliveredCount > 0,
      summary: result
    });
  } catch (err) {
    console.error('[Test SMS Error]', err);
    res.status(500).json({ error: 'Test SMS failed', details: err.message });
  }
});

// POST /api/alerts/send-sms (Explicit Human Trigger Broadcast)
router.post('/send-sms', async (req, res) => {
  try {
    const { recipients, message } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list must be a non-empty array of phone numbers.' });
    }
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Alert message content cannot be empty.' });
    }

    const result = await sendSms(recipients, message.trim());
    const alertId = `ALERT-MANUAL-${Date.now()}`;
    
    let statusText = `COMPLETED (${result.deliveredCount}/${result.totalSent} Delivered)`;
    if (result.isSimulation) {
      statusText = `SIMULATED (${result.deliveredCount}/${result.totalSent})`;
    } else if (result.deliveredCount === 0) {
      statusText = `FAILED (0/${result.totalSent} Delivered)`;
    }

    await queryExec(
      `INSERT INTO alerts_log (id, trigger_type, message, recipients, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        'MANUAL',
        message.trim(),
        JSON.stringify(recipients),
        statusText,
        new Date().toISOString()
      ]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('alert_sent', {
        id: alertId,
        trigger_type: 'MANUAL',
        message: message.trim(),
        recipients,
        status: statusText,
        deliverySummary: result,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: result.isSimulation 
        ? 'Simulation warning broadcast logged (No real SMS sent; configure gateway in Settings).' 
        : (result.deliveredCount > 0 ? 'SMS warning broadcast dispatched successfully.' : 'SMS dispatch attempted but failed.'),
      deliverySummary: result,
      alertId
    });
  } catch (err) {
    console.error('[Send SMS Route Error]', err);
    res.status(500).json({ error: 'Failed to send SMS alerts.', details: err.message });
  }
});

// GET /api/alerts/history (Audit Log)
router.get('/history', async (req, res) => {
  try {
    const logs = await queryAll('SELECT * FROM alerts_log ORDER BY timestamp DESC LIMIT 100');
    const parsed = logs.map(l => ({
      ...l,
      recipients: typeof l.recipients === 'string' ? JSON.parse(l.recipients) : l.recipients
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve alert audit history.' });
  }
});

export default router;
