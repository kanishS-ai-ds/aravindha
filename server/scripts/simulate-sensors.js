/**
 * ARAVINDHA IoT Ground Sensor Simulator
 * Generates realistic soil moisture, river water level, and tilt sensor readings
 * across North Eastern Region stations for demo and testing purposes.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/api/sensors/reading';

const SENSOR_NODES = [
  { id: 'SENSOR-GHY-01', type: 'soil_moisture', unit: '%', lat: 26.1445, lon: 91.7362, base: 68 },
  { id: 'SENSOR-SHL-02', type: 'tilt_sensor', unit: '°', lat: 25.5788, lon: 91.8933, base: 3.2 },
  { id: 'SENSOR-ITN-03', type: 'water_level', unit: 'm', lat: 27.0844, lon: 93.6053, base: 4.8 },
  { id: 'SENSOR-IMP-04', type: 'soil_moisture', unit: '%', lat: 24.8170, lon: 93.9368, base: 74 },
  { id: 'SENSOR-AIZ-05', type: 'tilt_sensor', unit: '°', lat: 23.7271, lon: 92.7176, base: 8.5 }
];

async function sendSensorTelemetry() {
  for (const node of SENSOR_NODES) {
    // Generate slight noise variation
    const noise = (Math.random() - 0.5) * (node.type === 'tilt_sensor' ? 0.8 : 2.5);
    const val = parseFloat((node.base + noise).toFixed(2));

    const payload = {
      sensor_id: node.id,
      type: node.type,
      value: val,
      unit: node.unit,
      lat: node.lat,
      lon: node.lon,
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        console.log(`[Sensor Simulator] Transmitted telemetry from ${node.id} -> ${val}${node.unit}`);
      }
    } catch (err) {
      console.warn(`[Sensor Simulator] Transmission failed:`, err.message);
    }
  }
}

console.log('[Sensor Simulator] Starting IoT telemetry push stream (every 5 seconds)...');
setInterval(sendSensorTelemetry, 5000);
sendSensorTelemetry();
