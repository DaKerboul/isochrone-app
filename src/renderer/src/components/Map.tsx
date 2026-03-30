import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/useAppStore'
import type { FeatureCollection } from 'geojson'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const SRC_ISO = 'isochrones'
const SRC_POINT = 'point'
const LAYER_FILL = 'iso-fill'
const LAYER_LINE = 'iso-line'
const LAYER_POINT = 'point-dot'

interface MapViewProps {
  mapRef: React.MutableRefObject<maplibregl.Map | null>
}

export function MapView({ mapRef }: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { point, setPoint, isochrones } = useAppStore()

  // Keep refs in sync for use inside map event handlers / load callback
  const isochronesRef = useRef<FeatureCollection | null>(null)
  const pointRef = useRef<[number, number] | null>(null)
  isochronesRef.current = isochrones
  pointRef.current = point

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [2.3522, 48.8566],
      zoom: 5,
      canvasContextAttributes: { preserveDrawingBuffer: true } // needed for PNG export
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')
    map.getCanvas().style.cursor = 'crosshair'

    map.on('load', () => {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

      // Isochrone layers
      map.addSource(SRC_ISO, { type: 'geojson', data: empty })
      map.addLayer({
        id: LAYER_FILL,
        type: 'fill',
        source: SRC_ISO,
        paint: { 'fill-color': ['get', 'isoColor'], 'fill-opacity': 0.25 }
      })
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SRC_ISO,
        paint: { 'line-color': ['get', 'isoColor'], 'line-width': 2, 'line-opacity': 0.9 }
      })

      // Departure point dot
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

      // Apply data that may have been set before load fired
      if (isochronesRef.current) applyIsochrones(map, isochronesRef.current)
      if (pointRef.current) applyPoint(map, pointRef.current)
    })

    map.on('click', (e) => {
      setPoint([e.lngLat.lng, e.lngLat.lat])
    })

    mapRef.current = map
    return () => {
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

  // Sync isochrones to map
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    applyIsochrones(map, isochrones)
  }, [isochrones]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="map-container" />
}

function applyPoint(map: maplibregl.Map, point: [number, number] | null): void {
  const src = map.getSource(SRC_POINT) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(
    point
      ? {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: {} }
          ]
        }
      : { type: 'FeatureCollection', features: [] }
  )
}

function applyIsochrones(map: maplibregl.Map, data: FeatureCollection | null): void {
  const src = map.getSource(SRC_ISO) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(data ?? { type: 'FeatureCollection', features: [] })

  if (data && data.features.length > 0) {
    const coords = data.features.flatMap((f) => {
      const g = f.geometry
      if (g.type === 'Polygon') return g.coordinates[0]
      if (g.type === 'MultiPolygon') return g.coordinates.flatMap((p) => p[0])
      return []
    })
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ],
      { padding: 60, duration: 800 }
    )
  }
}
