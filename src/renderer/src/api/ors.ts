import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'
import type { TransportMode } from '../store/useAppStore'

export const ISOCHRONE_COLORS = ['#4ade80', '#fbbf24', '#f87171', '#c084fc', '#60a5fa']

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
  ranges: number[],
  apiKey: string
): Promise<FeatureCollection> {
  // ORS expects largest range first
  const sorted = [...ranges].sort((a, b) => b - a)

  const response = await fetch(`https://api.openrouteservice.org/v2/isochrones/${mode}`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json, application/geo+json'
    },
    body: JSON.stringify({
      locations: [point],
      range: sorted,
      range_type: 'time',
      smoothing: 10
    })
  })

  if (!response.ok) {
    const text = await response.text()
    let msg = `Erreur ORS ${response.status}`
    try {
      const parsed = JSON.parse(text)
      msg = parsed.error?.message ?? parsed.message ?? msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const geojson: FeatureCollection = await response.json()

  // ORS returns features largest-first; we assign colors in that order
  const features: Feature<Polygon | MultiPolygon>[] = geojson.features.map((f, i) => ({
    ...(f as Feature<Polygon | MultiPolygon>),
    properties: {
      ...f.properties,
      isoColor: ISOCHRONE_COLORS[i % ISOCHRONE_COLORS.length],
      isoIndex: i,
      isoLabel: formatDuration((f.properties?.value as number) ?? sorted[i])
    }
  }))

  return { type: 'FeatureCollection', features } as FeatureCollection
}
