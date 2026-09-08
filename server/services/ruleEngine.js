import { queryOne, queryExec } from '../db/database.js';
import { sendSms } from './smsGateway.js';
import { queryAll } from '../db/database.js';

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export async function evaluateRiskAndSensors(locationName, riskScore, riskLevel, factors) {
  if (!ioInstance) return;

  const alertPayload = {
    id: `ALERT-${Date.now()}`,
    location: locationName,
    riskScore,
    riskLevel,
    factors,
    timestamp: new Date().toISOString()
  };

  // Broadcast risk update over Socket.IO
  ioInstance.emit('risk_update', alertPayload);

  // If risk crosses HIGH or SEVERE, generate system alert
  if (riskLevel === 'HIGH' || riskLevel === 'SEVERE') {
    ioInstance.emit('system_alert', {
      ...alertPayload,
      title: `${riskLevel} LANDSLIDE HAZARD IN ${locationName.toUpperCase()}`,
      message: `ML predictive engine flagged ${riskLevel} landslide hazard score (${riskScore}/100) in ${locationName}.`
    });

    // Check if auto SMS for SEVERE is enabled
    if (riskLevel === 'SEVERE') {
      const smsSetting = await queryOne("SELECT value FROM settings WHERE key = 'auto_sms_severe'");
      if (smsSetting && smsSetting.value === 'true') {
        const contacts = await queryAll('SELECT phone FROM contacts');
        const phoneNumbers = contacts.map(c => c.phone);
        
        if (phoneNumbers.length > 0) {
          const smsText = `EMERGENCY ALERT [ARAVINDHA]: SEVERE Landslide Hazard detected in ${locationName} (Risk Index ${riskScore}/100). Take immediate precautions!`;
          const result = await sendSms(phoneNumbers, smsText);
          
          await queryExec(
            `INSERT INTO alerts_log (id, trigger_type, message, recipients, status, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              `AUTOSMS-${Date.now()}`,
              'AUTOMATED_SEVERE',
              smsText,
              JSON.stringify(phoneNumbers),
              `SENT (${result.deliveredCount}/${result.totalSent})`,
              new Date().toISOString()
            ]
          );
          
          console.log(`[Rule Engine] Auto-SMS broadcast executed for ${locationName}.`);
        }
      }
    }
  }
}
