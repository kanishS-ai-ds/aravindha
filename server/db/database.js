import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPg = false;
let pgPool = null;
let sqliteDb = null;

// Determine database driver
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_HOST;

if (dbUrl) {
  isPg = true;
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER || 'aravindha'}:${process.env.POSTGRES_PASSWORD || 'aravindha'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'aravindha'}`,
  });
  console.log('[Database] Operating with PostgreSQL + PostGIS connection.');
} else {
  console.log('[Database] No Postgres URL configured; initializing SQLite fallback database.');
  const dbPath = path.join(__dirname, 'aravindha.sqlite');
  sqliteDb = new sqlite3.Database(dbPath);
}

export async function initDb() {
  if (isPg) {
    try {
      const client = await pgPool.connect();
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      await client.query(schemaSql);
      client.release();
      console.log('[Database] PostGIS schema verified.');
    } catch (err) {
      console.error('[Database] Postgres connection error, switching to SQLite fallback:', err.message);
      isPg = false;
      const dbPath = path.join(__dirname, 'aravindha.sqlite');
      sqliteDb = new sqlite3.Database(dbPath);
      await initSqliteSchema();
    }
  } else {
    await initSqliteSchema();
  }

  await seedDefaults();
}

function initSqliteSchema() {
  return new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS field_reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        hazard_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT,
        photo_url TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        submitter TEXT DEFAULT 'Field Officer',
        status TEXT DEFAULT 'VERIFIED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS risk_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        confidence REAL,
        factors TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS predictions_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_payload TEXT NOT NULL,
        output_prediction TEXT NOT NULL,
        model_version TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS weather_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        temperature REAL,
        rainfall_mm REAL,
        humidity REAL,
        wind_speed REAL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        district TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS alerts_log (
        id TEXT PRIMARY KEY,
        trigger_type TEXT NOT NULL,
        message TEXT NOT NULL,
        recipients TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });

      sqliteDb.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
    });
  });
}

async function seedDefaults() {
  // Seed default contacts if empty
  const existingContacts = await queryAll('SELECT * FROM contacts');
  if (existingContacts.length === 0) {
    console.log('[Database] Seeding default NER emergency contact list...');
    await queryExec('INSERT INTO contacts (id, name, phone, district) VALUES (?, ?, ?, ?)',
      ['c1', 'Disaster Control Room', '+919876543210', 'Kamrup Metropolitan (Guwahati)']);
    await queryExec('INSERT INTO contacts (id, name, phone, district) VALUES (?, ?, ?, ?)',
      ['c2', 'State Emergency Op Center', '+919876543211', 'East Khasi Hills (Shillong)']);
    await queryExec('INSERT INTO contacts (id, name, phone, district) VALUES (?, ?, ?, ?)',
      ['c3', 'Sub-Divisional Officer', '+919876543212', 'Papum Pare (Itanagar)']);
  }

  // Seed default auto-SMS toggle setting if not exists
  const smsSetting = await queryOne('SELECT * FROM settings WHERE key = ?', ['auto_sms_severe']);
  if (!smsSetting) {
    await queryExec('INSERT INTO settings (key, value) VALUES (?, ?)', ['auto_sms_severe', 'false']);
  }
}

export function queryAll(sql, params = []) {
  if (isPg) {
    let pgSql = sql;
    let idx = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);
    return pgPool.query(pgSql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

export function queryOne(sql, params = []) {
  return queryAll(sql, params).then(rows => rows[0] || null);
}

export function queryExec(sql, params = []) {
  if (isPg) {
    let pgSql = sql;
    let idx = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);
    return pgPool.query(pgSql, params);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}
