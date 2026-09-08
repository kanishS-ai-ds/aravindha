# ARAVINDHA — Cloud Deployment & Setup Guide

## Quick Local Setup with Docker Compose

To start the entire platform (PostgreSQL+PostGIS, Python ML Microservice, Node Backend API) with a single command:

```bash
docker-compose up --build
```

Access services at:
- **Vite GIS Dashboard**: `http://localhost:5173` (run `npm run dev` in project root)
- **Node API & WebSockets**: `http://localhost:4000`
- **FastAPI ML Microservice**: `http://localhost:8000/docs`
- **Mobile Field PWA**: `http://localhost:4000/mobile/` or serve directly via web browser

---

## Environment Variables

### Backend (`server/.env`)
```env
PORT=4000
DATABASE_URL=postgres://aravindha:aravindhapassword@localhost:5432/aravindha
ML_SERVICE_URL=http://localhost:8000
IMD_API_KEY=your_optional_data_gov_in_key
SMS_PROVIDER=MOCK # Options: MOCK, TWILIO, MSG91
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
```

### ML Microservice (`ml-service/.env`)
```env
PORT=8000
```

---

## Running Telemetry Simulator

To simulate live IoT ground sensors (soil moisture, water level, tilt sensors):

```bash
cd server
npm run simulate-sensors
```

---

## Cloud Deployment Options

- **Render / Railway**: Deploy `server/` as a Web Service, `ml-service/` as a Python Web Service, and attach a Managed PostgreSQL with PostGIS extension.
- **AWS / GCP**: Deploy containers using AWS ECS / GCP Cloud Run connected to RDS PostgreSQL PostGIS instance.
