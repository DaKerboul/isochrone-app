import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'
import type { TransportMode } from '../store/useAppStore'

export const ISOCHRONE_COLORS = ['#4ade80', '#fbbf24', '#f87171', '#c084fc', '#60a5fa']

// Valhalla costing profiles
const COSTING_MAP: Record<TransportMode, string> = {
  auto: 'auto',
  bicycle: 'bicycle',
  pedestrian: 'pedestrian'
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m.toString().padStart(2, '0')}`
  if (h > 0) return `${h}h`
  return `${m}min`
}

export async function fetchIsochrones(
  point: [number, number],
  mode: TransportMode,
  ranges: number[], // in seconds
  valhallaUrl: string
): Promise<FeatureCollection> {
  // Valhalla expects minutes, sorted ascending
  const sorted = [...ranges].sort((a, b) => a - b)
  const contours = sorted.map((s) => ({ time: s / 60 }))

  const url = `${valhallaUrl.replace(/\/$/, '')}/isochrone`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [{ lon: point[0], lat: point[1] }],
      costing: COSTING_MAP[mode],
      contours,
      polygons: true,
      denoise: 0.5,
      generalize: 150
    })
  })

  if (!response.ok) {
    const text = await response.text()
    let msg = `Erreur Valhalla ${response.status}`
    try {
      const parsed = JSON.parse(text)
      msg = parsed.error ?? parsed.error_code ? `Valhalla ${parsed.error_code}: ${parsed.error}` : msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const geojson: FeatureCollection = await response.json()

  // Valhalla returns features smallest-first; reverse for layering (big polygon below)
  const reversed = [...geojson.features].reverse()
  const features: Feature<Polygon | MultiPolygon>[] = reversed.map((f, i) => ({
    ...(f as Feature<Polygon | MultiPolygon>),
    properties: {
      ...f.properties,
      isoColor: ISOCHRONE_COLORS[i % ISOCHRONE_COLORS.length],
      isoIndex: i,
      isoLabel: formatDuration(((f.properties?.contour as number | undefined) ?? sorted[i] / 60) * 60)
    }
  }))

  return { type: 'FeatureCollection', features } as FeatureCollection
}
