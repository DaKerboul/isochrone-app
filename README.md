# Isochrone App

> Offline isochrone map explorer — Electron desktop app + deployable web SPA, powered by a self-hosted [Valhalla](https://github.com/valhalla/valhalla) routing engine.

[![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-5-396CB2?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Valhalla](https://img.shields.io/badge/Routing-Valhalla-FF6B35?logo=openstreetmap&logoColor=white)](https://github.com/valhalla/valhalla)
[![Self-hosted](https://img.shields.io/badge/self--hosted-100%25_offline-22c55e)](https://github.com/DaKerboul/isochrone-app)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

![isochrone demo](https://raw.githubusercontent.com/DaKerboul/isochrone-app/master/resources/screenshot.png)

---

## What is this?

An isochrone map shows you **all the places you can reach within a given time** from a starting point. This app lets you:

- Click anywhere on the map to set a departure point
- Choose a transport mode (🚗 car / 🚲 bike / 🚶 walking)
- Configure up to 8 time ranges (e.g. 15min, 30min, 1h, 2h, 4h, 8h...)
- See the reachable areas rendered as colored polygons on a dark map

Everything runs **100% offline and self-hosted** — no external routing API, no data leaves your infrastructure.

---

## Features

- **Offline-first** — Valhalla routing engine runs locally (Docker / WSL / Proxmox CT)
- **Dark map** — CartoCDN dark tiles
- **Per-mode color palettes** — green (walking) / cyan (bike) / amber (car)
- **Interactive legend** — click to toggle individual isochrone layers
- **Hover popup** — hover an isochrone to see its duration
- **Right-click context menu** — set departure point from map
- **Geocoder** — search for a place by name (Nominatim/OpenStreetMap)
- **Export** — save as GeoJSON or PNG
- **History** — last 5 searches, one-click restore
- **Auto-recalculate** — toggle to recompute automatically on param changes
- **Toast notifications** — timing feedback, copy coordinates
- **Abort in-flight requests** — start a new calculation without waiting
- **Dual build target** — Electron desktop app + standalone web SPA (`npm run build:web`)

---

## Architecture

```
┌─────────────────────────────────────┐
│           Electron Main             │
│  - Manages Valhalla Docker container│
│  - Proxies HTTP via Node.js         │
│  - IPC bridge (preload)             │
└────────────────┬────────────────────┘
                 │ IPC (Electron) / fetch (Web)
┌────────────────▼────────────────────┐
│         React Renderer (SPA)        │
│  MapLibre GL  │  Zustand store      │
│  ControlPanel │  TimeRangeEditor    │
│  Legend       │  Toast / MapOverlay │
└────────────────┬────────────────────┘
                 │ HTTP POST /isochrone
┌────────────────▼────────────────────┐
│        Valhalla Routing Engine      │
│  ghcr.io/gis-ops/docker-valhalla    │
│  OSM tiles built from Geofabrik PBF │
└─────────────────────────────────────┘
```

### Key files

| Path | Role |
|------|------|
| `src/main/index.ts` | Electron main: Docker lifecycle, IPC handlers, HTTP proxy |
| `src/preload/index.ts` | Electron preload: exposes `window.api` to renderer |
| `src/renderer/src/api/ors.ts` | Valhalla fetch logic, color palettes, polygon simplification |
| `src/renderer/src/store/useAppStore.ts` | Zustand global state |
| `src/renderer/src/components/Map.tsx` | MapLibre map, layers, hover, context menu, labels |
| `src/renderer/src/components/ControlPanel.tsx` | Left panel: mode, geocoder, time ranges, history |
| `src/renderer/src/components/TimeRangeEditor.tsx` | Time range chips + presets |
| `src/renderer/src/components/Legend.tsx` | Interactive layer legend |
| `vite.web.config.ts` | Vite config for standalone web SPA build |

---

## Stack

- **Frontend** — React 19, TypeScript, Vite
- **Map** — MapLibre GL v5
- **State** — Zustand v5
- **Desktop shell** — Electron 39
- **Routing engine** — Valhalla (self-hosted via Docker)
- **Map tiles** — CartoCDN dark (raster)
- **Geocoding** — Nominatim (OpenStreetMap)

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for running Valhalla locally)
- WSL2 with Ubuntu (if on Windows)

### Install

```bash
npm install
```

### Build Valhalla tiles

Download an OSM extract from [Geofabrik](https://download.geofabrik.de/) and place it in a `valhalla/` directory, then:

```bash
docker run --rm \
  -v ./valhalla:/custom_files \
  -e build_tar=True \
  -e serve_tiles=False \
  -e concurrency=8 \
  ghcr.io/gis-ops/docker-valhalla/valhalla:latest \
  build_tiles
```

This produces `valhalla/valhalla_tiles.tar` (~8–12 GB for France).

### Run Valhalla service

```bash
docker run -d \
  --name valhalla-service \
  -p 8002:8002 \
  -v ./valhalla:/custom_files \
  --entrypoint /usr/local/bin/valhalla_service \
  ghcr.io/gis-ops/docker-valhalla/valhalla:latest \
  /custom_files/valhalla.json 4
```

### Run the Electron app

```bash
npm run dev
```

### Build standalone web SPA

```bash
VITE_VALHALLA_URL=https://your-valhalla-instance.example.com npm run build:web
# Output in dist-web/
```

Set `VITE_VALHALLA_URL` to your public Valhalla endpoint. The SPA calls it directly from the browser (CORS must be enabled on the Valhalla side).

---

## Configuration

### Valhalla limits

Edit `valhalla/valhalla.json` to increase default limits:

```json
"service_limits": {
  "isochrone": {
    "max_contours": 8,
    "max_time_contour": 600
  }
}
```

### Environment variables (web SPA)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_VALHALLA_URL` | `http://127.0.0.1:8002` | Base URL of Valhalla service |

---

## Self-hosted deployment

This app is designed to run self-hosted. The recommended setup:

```
Browser → isochrone.example.com  (static SPA via CDN / Coolify / Nginx)
               ↓ fetch
          valhalla.example.com  (Traefik → Valhalla Docker on a Proxmox CT)
```

Traefik config example (restrict CORS + rate limit):

```yaml
middlewares:
  cors-isochrone:
    headers:
      accessControlAllowOriginList: ["https://isochrone.example.com"]
      accessControlAllowMethods: [GET, POST, OPTIONS]
      accessControlAllowHeaders: [Content-Type]
  valhalla-ratelimit:
    rateLimit:
      average: 20
      burst: 10
      period: 1m
```

---

## License

MIT
