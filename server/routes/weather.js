import express from 'express';
import { getLatestWeatherReadings, fetchLiveWeather } from '../services/imdWeather.js';

const router = express.Router();

// GET /api/weather/latest
router.get('/latest', async (req, res) => {
  try {
    const readings = await getLatestWeatherReadings();
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve weather readings.' });
  }
});

// POST /api/weather/refresh (Manual force-refresh trigger)
router.post('/refresh', async (req, res) => {
  try {
    const updated = await fetchLiveWeather();
    res.json({ message: 'Weather refreshed successfully', readings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh weather.' });
  }
});

export default router;
