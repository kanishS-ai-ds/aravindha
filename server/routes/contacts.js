import express from 'express';
import { queryExec, queryAll, queryOne } from '../db/database.js';

const router = express.Router();

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const contacts = await queryAll('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emergency contacts.' });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { name, phone, district } = req.body;
    if (!name || !phone || !district) {
      return res.status(400).json({ error: 'Name, phone number, and district are required.' });
    }

    const id = `c_${Date.now()}`;
    await queryExec(
      `INSERT INTO contacts (id, name, phone, district, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, name, phone, district, new Date().toISOString()]
    );

    const contact = await queryOne('SELECT * FROM contacts WHERE id = ?', [id]);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add emergency contact.' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await queryExec('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Contact deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact.' });
  }
});

export default router;
