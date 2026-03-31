import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/useAppStore'
import type { FeatureCollection } from 'geojson'

const BASEMAP_TILES = {
  dark: [
    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  ],
  light: [
    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
  ],
  satellite: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ],
}

const ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'bg-dark':      { type: 'raster', tiles: BASEMAP_TILES.dark,      tileSize: 256, attribution: ATTRIBUTION },
    'bg-light':     { type: 'raster', tiles: BASEMAP_TILES.light,     tileSize: 256, attribution: ATTRIBUTION },
    'bg-satellite': { type: 'raster', tiles: BASEMAP_TILES.satellite, tileSize: 256, attribution: '&copy; Esri' },
  },
  layers: [
    { id: 'bg-dark-layer',      type: 'raster', source: 'bg-dark' },
    { id: 'bg-light-layer',     type: 'raster', source: 'bg-light',     layout: { visibility: 'none' } },
    { id: 'bg-satellite-layer', type: 'raster', source: 'bg-satellite', layout: { visibility: 'none' } },
  ]
}

const BG_LAYERS = { dark: 'bg-dark-layer', light: 'bg-light-layer', satellite: 'bg-satellite-layer' }

const SRC_ISO = 'isochrones'
const SRC_POINT = 'point'
const LAYER_FILL = 'iso-fill'
const LAYER_LINE = 'iso-line'
const LAYER_POINT = 'point-dot'

interface MapViewProps {
  mapRef: React.MutableRefObject<maplibregl.Map | null>
}

type ContextMenu = { lng: number; lat: number; x: number; y: number } | null

export function MapView({ mapRef }: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { point, setPoint, isochrones, hiddenLayers, timeRanges, basemap, setBasemap } = useAppStore()
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null)

  const isochronesRef = useRef<FeatureCollection | null>(null)
  const pointRef = useRef<[number, number] | null>(null)
  const hoveredIdRef = useRef<number | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)

  isochronesRef.current = isochrones
  pointRef.current = point

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [2.3522, 48.8566],
      zoom: 6,
      canvasContextAttributes: { preserveDrawingBuffer: true }
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')
    map.getCanvas().style.cursor = 'crosshair'

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'iso-popup',
      maxWidth: 'none',
      offset: 8
    })
    popupRef.current = popup

    map.on('load', () => {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

      map.addSource(SRC_ISO, { type: 'geojson', data: empty, generateId: false })
      map.addLayer({
        id: LAYER_FILL,
        type: 'fill',
        source: SRC_ISO,
        paint: {
          'fill-color': ['get', 'isoColor'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hovered'], false], 0.6, ['get', 'isoOpacity']],
          'fill-opacity-transition': { duration: 500, delay: 0 }
        }
      })
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SRC_ISO,
        paint: {
          'line-color': ['get', 'isoColor'],
          'line-width': 2,
          'line-opacity': 0.9,
          'line-opacity-transition': { duration: 500, delay: 0 }
        }
      })

      map.addSource(SRC_POINT, { type: 'geojson', data: empty })
      map.addLayer({
        id: LAYER_POINT,
        type: 'circle',
        source: SRC_POINT,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#3b82f6',
          'circle-stroke-width': 3
        }
      })

      map.on('mouseenter', LAYER_FILL, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_FILL, () => { map.getCanvas().style.cursor = 'crosshair' })

      map.on('mousemove', LAYER_FILL, (e) => {
        if (!e.features?.length) return
        const f = e.features[0]
        const fid = f.id as number
        if (hoveredIdRef.current !== null && hoveredIdRef.current !== fid) {
          map.setFeatureState({ source: SRC_ISO, id: hoveredIdRef.current }, { hovered: false })
        }
        hoveredIdRef.current = fid
        map.setFeatureState({ source: SRC_ISO, id: fid }, { hovered: true })
        const label = f.properties?.isoLabel as string
        popup.setLngLat(e.lngLat).setHTML(`<span>${label}</span>`).addTo(map)
      })

      map.on('mouseleave', LAYER_FILL, () => {
        if (hoveredIdRef.current !== null) {
          map.setFeatureState({ source: SRC_ISO, id: hoveredIdRef.current }, { hovered: false })
        }
        hoveredIdRef.current = null
        popup.remove()
      })

      map.on('contextmenu', (e) => {
        e.preventDefault()
        setContextMenu({ lng: e.lngLat.lng, lat: e.lngLat.lat, x: e.point.x, y: e.point.y })
      })
      map.on('click', (e) => {
        setContextMenu(null)
        setPoint([e.lngLat.lng, e.lngLat.lat])
      })

      if (isochronesRef.current) applyIsochrones(map, isochronesRef.current, markersRef)
      if (pointRef.current) applyPoint(map, pointRef.current)
    })

    mapRef.current = map
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popup.remove()
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync point to map
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    applyPoint(map, point)
  }, [point]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync isochrones to map — with fade-in
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    map.setPaintProperty(LAYER_FILL, 'fill-opacity', 0)
    map.setPaintProperty(LAYER_LINE, 'line-opacity', 0)
    applyIsochrones(map, isochrones, markersRef)
    requestAnimationFrame(() => {
      if (!mapRef.current) return
      mapRef.current.setPaintProperty(LAYER_FILL, 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hovered'], false], 0.6, ['get', 'isoOpacity']
      ])
      mapRef.current.setPaintProperty(LAYER_LINE, 'line-opacity', 0.9)
    })
  }, [isochrones]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync hidden layers filter
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const total = timeRanges.length
    const visibleIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !hiddenLayers.has(i))
    const filter: maplibregl.FilterSpecification = visibleIndices.length > 0
      ? ['in', ['get', 'isoIndex'], ['literal', visibleIndices]]
      : ['==', 1, 0]
    map.setFilter(LAYER_FILL, filter)
    map.setFilter(LAYER_LINE, filter)
  }, [hiddenLayers, timeRanges]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync basemap
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    Object.values(BG_LAYERS).forEach((id) => map.setLayoutProperty(id, 'visibility', 'none'))
    map.setLayoutProperty(BG_LAYERS[basemap], 'visibility', 'visible')
  }, [basemap]) // eslint-disable-line react-hooks/exhaustive-deps

  const BASEMAP_ICONS = { dark: '🌙', light: '☀️', satellite: '🛰️' }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} className="map-container" />

      {/* Basemap switcher */}
      <div className="basemap-switcher">
        {(Object.keys(BASEMAP_ICONS) as Array<keyof typeof BASEMAP_ICONS>).map((b) => (
          <button
            key={b}
            className={`basemap-btn${basemap === b ? ' active' : ''}`}
            onClick={() => setBasemap(b)}
            title={b.charAt(0).toUpperCase() + b.slice(1)}
          >
            {BASEMAP_ICONS[b]}
          </button>
        ))}
      </div>

      {contextMenu && (
        <div
          className="map-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => {
            setPoint([contextMenu.lng, contextMenu.lat])
            setContextMenu(null)
          }}>
            📍 Set as starting point
          </button>
        </div>
      )}
    </div>
  )
}

function applyPoint(map: maplibregl.Map, point: [number, number] | null): void {
  const src = map.getSource(SRC_POINT) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(
    point
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: {} }] }
      : { type: 'FeatureCollection', features: [] }
  )
}

function computeCentroid(coords: number[][]): [number, number] {
  let x = 0, y = 0
  const n = coords.length
  for (const c of coords) { x += c[0]; y += c[1] }
  return [x / n, y / n]
}

function applyIsochrones(
  map: maplibregl.Map,
  data: FeatureCollection | null,
  markersRef: React.MutableRefObject<maplibregl.Marker[]>
): void {
  const src = map.getSource(SRC_ISO) as maplibregl.GeoJSONSource | undefined
  if (!src) return

  markersRef.current.forEach((m) => m.remove())
  markersRef.current = []

  src.setData(data ?? { type: 'FeatureCollection', features: [] })

  if (data && data.features.length > 0) {
    data.features.forEach((f) => {
      const label = f.properties?.isoLabel as string | undefined
      if (!label) return
      let centroid: [number, number] | null = null
      if (f.geometry.type === 'Polygon' && f.geometry.coordinates[0]?.length) {
        centroid = computeCentroid(f.geometry.coordinates[0])
      } else if (f.geometry.type === 'MultiPolygon' && f.geometry.coordinates[0]?.[0]?.length) {
        centroid = computeCentroid(f.geometry.coordinates[0][0])
      }
      if (!centroid) return
      const el = document.createElement('div')
      el.className = 'iso-map-label'
      el.textContent = label
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(centroid)
        .addTo(map)
      markersRef.current.push(marker)
    })

    const coords = data.features.flatMap((f) => {
      const g = f.geometry
      if (g.type === 'Polygon') return g.coordinates[0]
      if (g.type === 'MultiPolygon') return g.coordinates.flatMap((p) => p[0])
      return []
    })
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 800 }
    )
  }
}
