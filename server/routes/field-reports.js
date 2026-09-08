import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { queryExec, queryAll, queryOne } from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Upload destination for photos
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/field-reports (Submit report with photo + metadata)
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { title, hazard_type, severity, description, latitude, longitude, submitter } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and Longitude are required for geotagging.' });
    }

    const id = `FR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : '/uploads/default_hazard.jpg';
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    await queryExec(
      `INSERT INTO field_reports (id, title, hazard_type, severity, description, photo_url, latitude, longitude, submitter, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title || `${hazard_type || 'Hazard'} Report`,
        hazard_type || 'Landslide',
        severity || 'MODERATE',
        description || '',
        photo_url,
        lat,
        lon,
        submitter || 'Field Officer',
        'VERIFIED',
        new Date().toISOString()
      ]
    );

    const newReport = await queryOne('SELECT * FROM field_reports WHERE id = ?', [id]);

    // Broadcast live update over WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('new_field_report', newReport);
    }

    res.status(201).json({
      message: 'Field report submitted and geotagged successfully.',
      report: newReport
    });
  } catch (err) {
    console.error('[Field Reports Route Error]', err);
    res.status(500).json({ error: 'Failed to save field report.', details: err.message });
  }
});

// GET /api/field-reports (List all field reports)
router.get('/', async (req, res) => {
  try {
    const reports = await queryAll('SELECT * FROM field_reports ORDER BY created_at DESC');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch field reports.' });
  }
});

// PATCH /api/field-reports/:id/verify (Admin verification / status update)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await queryExec('UPDATE field_reports SET status = ? WHERE id = ?', [status, req.params.id]);
    const updated = await queryOne('SELECT * FROM field_reports WHERE id = ?', [req.params.id]);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('field_report_updated', updated);
    }
    
    res.json({ message: 'Status updated', report: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update field report status.' });
  }
});

export default router;
