# AGENT.md — Isochrone App

Architecture and development guide for AI agents working on this codebase.

---

## What this app does

Renders isochrone maps (reachable-area polygons by travel time) on top of a dark MapLibre map.
The user clicks a point, picks a transport mode and time ranges, and the app calls a local Valhalla instance to compute the polygons.

---

## Build targets

| Target | Command | Output | Entry |
|--------|---------|--------|-------|
| Electron desktop | `npm run dev` / `npm run build` | `out/` | `src/main/index.ts` |
| Web SPA | `npm run build:web` | `dist-web/` | `src/renderer/index.html` |

**The renderer (`src/renderer/`) is shared between both targets.** The only difference is how Valhalla is called:
- Electron: via IPC (`window.api.valhallaFetch`) → main process proxies with Node.js `http`
- Web: via native `fetch()` directly to `VITE_VALHALLA_URL`

The adapter lives entirely in `src/renderer/src/api/ors.ts`.

---

## Project layout

```
src/
  main/
    index.ts              # Electron main process
                          #   - starts/stops Valhalla Docker container (WSL)
                          #   - IPC handlers: valhalla-fetch, valhalla-abort, valhalla-status
                          #   - Node.js http proxy (bypasses Chromium for localhost)
  preload/
    index.ts              # contextBridge: exposes window.api to renderer
    index.d.ts            # TypeScript types for window.api
  renderer/
    index.html            # SPA entry point
    src/
      main.tsx            # React root
      App.tsx             # Root component: Valhalla probe, auto-recalculate, splash/error
      env.d.ts            # ImportMetaEnv: VITE_VALHALLA_URL
      api/
        ors.ts            # Valhalla fetch, color palettes, polygon simplification (RDP)
      store/
        useAppStore.ts    # Zustand store (all global state)
      components/
        Map.tsx           # MapLibre map, isochrone layers, hover/click/contextmenu
        ControlPanel.tsx  # Left panel UI: mode, geocoder, time ranges, history, error
        TimeRangeEditor.tsx  # Add/remove time ranges, preset chips
        Legend.tsx        # Interactive layer legend (toggle visibility)
        Toast.tsx         # Toast notification system
        MapOverlay.tsx    # Loading bar overlay
        Versions.tsx      # Electron version display (unused in web build)
      utils/
        geocoder.ts       # Nominatim search (fetch, no API key)
        export.ts         # GeoJSON / PNG export
      assets/
        main.css          # All app styles (dark theme, components)
        base.css          # CSS reset / root variables

vite.web.config.ts        # Vite config for standalone SPA build (no Electron)
electron.vite.config.ts   # electron-vite config (main + preload + renderer)
```

---

## State (Zustand — `useAppStore.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `point` | `[number, number] \| null` | Selected map point [lng, lat] |
| `mode` | `TransportMode` | `'auto' \| 'bicycle' \| 'pedestrian'` |
| `timeRanges` | `number[]` | Array of seconds (e.g. [900, 1800, 3600]) |
| `isochrones` | `FeatureCollection \| null` | Current computed isochrones |
| `loading` | `boolean` | Fetch in progress |
| `error` | `string \| null` | Last error message |
| `valhallaStatus` | `'starting' \| 'ready' \| 'error'` | Routing engine status |
| `toasts` | `Toast[]` | Active toast notifications |
| `history` | `HistoryEntry[]` | Last 5 calculations (max) |
| `hiddenLayers` | `Set<number>` | isoIndex values of hidden layers |
| `autoRecalculate` | `boolean` | Auto-recompute on param change |

---

## Data flow

```
User click on map
  → Map.tsx sets point in store
  → ControlPanel.tsx calls fetchIsochrones()
      → ors.ts: builds Valhalla request body
      → Electron: window.api.valhallaFetch() → IPC → Node http.request → Valhalla
        Web: fetch(VITE_VALHALLA_URL + '/isochrone')
      → response: raw GeoJSON FeatureCollection
      → ors.ts: reverses features (outermost first), stamps isoColor/isoOpacity/isoIndex/isoLabel, RDP-simplifies polygons
      → store.setIsochrones(data)
  → Map.tsx useEffect([isochrones]): updates GeoJSON source, animates opacity, places label markers
  → Legend.tsx: renders color swatches from getIsochroneColors(mode)
```

---

## Valhalla integration

### Request format

```json
POST /isochrone
{
  "locations": [{ "lon": 2.3488, "lat": 48.8534 }],
  "costing": "auto",
  "contours": [{ "time": 15 }, { "time": 30 }, { "time": 60 }],
  "polygons": true,
  "denoise": 0.5,
  "generalize": 150
}
```

### Response

GeoJSON `FeatureCollection`. Each feature has `properties.contour` (time in minutes).

### Limits (configured in `valhalla.json`)

```json
"service_limits": {
  "isochrone": {
    "max_contours": 8,
    "max_time_contour": 600
  }
}
```

### Color palettes (per transport mode)

Defined in `ors.ts` — `ISOCHRONE_COLORS: Record<TransportMode, string[]>`. Export `getIsochroneColors(mode)` used by Map, Legend, TimeRangeEditor.

---

## Map layers (MapLibre)

| Layer ID | Type | Source | Description |
|----------|------|--------|-------------|
| `iso-fill` | fill | `isochrones` GeoJSON | Isochrone polygons, opacity from `isoOpacity` feature property |
| `iso-line` | line | `isochrones` GeoJSON | Isochrone outlines |
| `point-dot` | circle | `point` GeoJSON | Departure point marker |

Feature-state `hovered: true` on `iso-fill` raises opacity to 0.6. Labels are DOM `Marker` elements with class `iso-map-label`.

Layer visibility is controlled via `map.setFilter(LAYER_FILL, ['in', ['get','isoIndex'], ['literal', visibleIndices]])` driven by `store.hiddenLayers`.

---

## CSS conventions

All styles in `src/renderer/src/assets/main.css`. CSS variables defined on `:root`:

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#0f111a` | App background |
| `--panel-bg` | `#161926` | Panel background |
| `--accent` | `#6366f1` | Primary accent (indigo) |
| `--danger` | `#f87171` | Error states |
| `--text` | `#e2e8f0` | Primary text |
| `--text-muted` | `#64748b` | Secondary text |
| `--radius` | `8px` | Standard border radius |

---

## Adding a new transport mode

1. Add key to `TransportMode` union in `useAppStore.ts`
2. Add entry to `COSTING_MAP` in `ors.ts` (Valhalla costing string)
3. Add color palette to `ISOCHRONE_COLORS` in `ors.ts`
4. Add button in `ControlPanel.tsx` mode selector with `data-mode` attribute
5. Add `.btn-mode.active[data-mode="..."]` style in `main.css`

---

## Environment

- Node.js 20+
- Valhalla: `ghcr.io/gis-ops/docker-valhalla/valhalla:latest`
- Tiles built from Geofabrik `.osm.pbf` extracts
- In Electron mode: Docker runs in WSL2 Ubuntu, port-forwarded to `127.0.0.1:8002`
- In web mode: `VITE_VALHALLA_URL` env var (injected at build time by Vite)

---

## Known constraints

- `VITE_VALHALLA_URL` is **build-time**, not runtime — rebuild needed to change the Valhalla URL
- Electron app assumes WSL2 Ubuntu with Docker at `/home/kerboul/valhalla/`
- CartoCDN tiles require internet access (map background only — routing is offline)
- `Versions.tsx` uses `window.electron` — renders nothing in web build (unused component)
