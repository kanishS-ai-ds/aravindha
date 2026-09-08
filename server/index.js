import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

import { initDb } from './db/database.js';
import { fetchLiveWeather } from './services/imdWeather.js';
import { setSocketIO } from './services/ruleEngine.js';

import fieldReportsRouter from './routes/field-reports.js';
import predictionsRouter from './routes/predictions.js';
import weatherRouter from './routes/weather.js';
import sensorsRouter from './routes/sensors.js';
import alertsRouter from './routes/alerts.js';
import contactsRouter from './routes/contacts.js';
import settingsRouter from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

const PORT = process.env.PORT || 4000;

// Setup Socket.IO reference in app & rule engine
app.set('io', io);
setSocketIO(io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos statically
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'ARAVINDHA Backend Server & Realtime Alert Gateway',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// API Routes
app.use('/api/field-reports', fieldReportsRouter);
app.use('/api', predictionsRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/sensors', sensorsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/settings', settingsRouter);

// Serve frontend static build in production
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}


// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  socket.emit('connection_ack', { message: 'Connected to ARAVINDHA Realtime Engine' });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// Initialize DB and start server
async function startServer() {
  await initDb();
  
  // Initial weather sync
  fetchLiveWeather().catch(err => console.warn('[IMD Weather Startup Error]', err.message));

  // Cron schedule: Poll live weather every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[Cron] Polling IMD/Open-Meteo weather updates...');
    fetchLiveWeather();
  });

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 ARAVINDHA Backend API Server running on port ${PORT}`);
    console.log(`📡 WebSocket Gateway ready for live data streaming`);
    console.log(`====================================================`);
  });
}

startServer();
