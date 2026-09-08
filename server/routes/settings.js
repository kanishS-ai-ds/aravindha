import express from 'express';
import { queryExec, queryAll, queryOne } from '../db/database.js';

const router = express.Router();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settingsList = await queryAll('SELECT * FROM settings');
    const settingsMap = {};
    settingsList.forEach(s => { settingsMap[s.key] = s.value; });
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// POST /api/settings/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings map required.' });
    }

    for (const [key, val] of Object.entries(settings)) {
      const existing = await queryOne('SELECT * FROM settings WHERE key = ?', [key]);
      if (existing) {
        await queryExec('UPDATE settings SET value = ? WHERE key = ?', [String(val), key]);
      } else {
        await queryExec('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(val)]);
      }
    }

    res.json({ message: 'All settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk update settings.', details: err.message });
  }
});

// POST /api/settings (Single key update)
router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Setting key required.' });

    const existing = await queryOne('SELECT * FROM settings WHERE key = ?', [key]);
    if (existing) {
      await queryExec('UPDATE settings SET value = ? WHERE key = ?', [String(value), key]);
    } else {
      await queryExec('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }

    res.json({ message: 'Setting saved.', key, value: String(value) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting.' });
  }
});

export default router;
