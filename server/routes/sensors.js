import express from 'express';
import { queryExec, queryAll } from '../db/database.js';

const router = express.Router();

// POST /api/sensors/reading
router.post('/reading', async (req, res) => {
  try {
    const { sensor_id, type, value, unit, lat, lon } = req.body;
    
    if (!sensor_id || !type || value === undefined) {
      return res.status(400).json({ error: 'Missing required sensor parameters (sensor_id, type, value).' });
    }

    const timestamp = req.body.timestamp || new Date().toISOString();
    await queryExec(
      `INSERT INTO sensor_readings (sensor_id, type, value, unit, latitude, longitude, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sensor_id, type, parseFloat(value), unit || '', parseFloat(lat || 26.14), parseFloat(lon || 91.73), timestamp]
    );

    const newReading = { sensor_id, type, value: parseFloat(value), unit: unit || '', lat, lon, timestamp };

    // Emit live update over WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('sensor_reading', newReading);
    }

    res.status(201).json({ message: 'Sensor reading ingested.', reading: newReading });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ingest sensor reading.', details: err.message });
  }
});

// GET /api/sensors/latest
router.get('/latest', async (req, res) => {
  try {
    const readings = await queryAll(
      `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50`
    );
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sensor readings.' });
  }
});

export default router;
