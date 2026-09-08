# ARAVINDHA — Disaster Intelligence System Architecture

## System Component Diagram

```
+-------------------------------------------------------------------------------+
|                             ARAVINDHA PLATFORM                                |
+-------------------------------------------------------------------------------+
                                       |
    +----------------------------------+----------------------------------+
    |                                  |                                  |
    v                                  v                                  v
+-----------------------+   +-----------------------+   +-----------------------+
|  Vite GIS Dashboard   |   |   Mobile Field PWA    |   |   IoT Sensor Nodes    |
| (MapLibre, Charts)    |   | (Offline IndexedDB)   |   |  (Telemetry Stream)   |
+-----------------------+   +-----------------------+   +-----------------------+
            |                           |                           |
            | HTTP / WebSockets         | REST / Photos Upload      | Telemetry Ingestion
            v                           v                           v
+-------------------------------------------------------------------------------+
|                       NODE.JS EXPRESS & SOCKET.IO API SERVER                  |
|   - Field Reports Ingestion & Geotag Storage                                  |
|   - Real-time WebSockets Broadcast Engine                                     |
|   - IMD & Weather API Poller Service                                          |
|   - SMS Gateway & Automated Warning Rule Engine                               |
+-------------------------------------------------------------------------------+
            |                                           |
            | Internal HTTP Inference                   | Read/Write GIS Geometry
            v                                           v
+-----------------------+                   +-----------------------+
|   Python FastAPI ML   |                   |  PostgreSQL + PostGIS |
| (Predictive Engine)   |                   |  (Spatial Database)   |
+-----------------------+                   +-----------------------+
```

## Service Responsibilities

1. **GIS Command Dashboard (`src/`)**:
   - Single-page application built with Vanilla JS & Vite.
   - Renders GIS layers (satellite/terrain tiles, NASA COOLR landslide events, USGS earthquakes, road connectivity).
   - Consumes live WebSocket updates for risk predictions, geotagged field report pins, and weather station statistics without re-rendering map canvas.

2. **Mobile Field Reporting PWA (`mobile/`)**:
   - Installable Web Application built with HTML/JS/CSS.
   - Direct camera photo capture and EXIF metadata handling.
   - Automatic GPS coordinates acquisition with manual pin fallback.
   - Service Worker caching and IndexedDB offline submission queue with automatic background synchronization when online.

3. **Node.js Express & Socket.IO API Backend (`server/`)**:
   - REST API for field reports, weather polling, sensor readings, alerts, and settings.
   - PostGIS integration for spatial bounding box query and point geometry indexing.
   - Real-time Socket.IO gateway broadcasting alerts to dashboard.

4. **Python FastAPI Predictive Analytics Engine (`ml-service/`)**:
   - Machine Learning microservice running a trained `GradientBoostingClassifier` model.
   - Evaluates rainfall, soil moisture, elevation, slope, historical landslide events, and seismic activity to return multi-level risk predictions and contributing factors.
