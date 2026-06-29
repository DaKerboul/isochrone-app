import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'
import type { TransportMode } from '../store/useAppStore'

const ISOCHRONE_COLORS: Record<TransportMode, string[]> = {
  pedestrian: ['#bbf7d0', '#4ade80', '#16a34a', '#166534', '#a3e635', '#65a30d', '#bef264', '#4d7c0f'],
  bicycle:    ['#a5f3fc', '#22d3ee', '#0891b2', '#155e75', '#818cf8', '#4338ca', '#6ee7b7', '#047857'],
  auto:       ['#fef08a', '#fbbf24', '#f97316', '#dc2626', '#e879f9', '#9333ea', '#fb7185', '#be123c'],
}

export function getIsochroneColors(mode: TransportMode): string[] {
  return ISOCHRONE_COLORS[mode]
}

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

// Adaptive params based on the largest contour in the request.
// Higher max range → larger polygon output → more aggressive simplification needed.
function adaptiveParams(maxRangeSec: number): { generalize: number; denoise: number } {
  if (maxRangeSec <= 1800)  return { generalize: 50,   denoise: 0.5 }
  if (maxRangeSec <= 3600)  return { generalize: 150,  denoise: 0.6 }
  if (maxRangeSec <= 7200)  return { generalize: 500,  denoise: 0.8 }
  if (maxRangeSec <= 14400) return { generalize: 1500, denoise: 0.9 }
  return                           { generalize: 3000, denoise: 1.0 }
}

// Ramer-Douglas-Peucker simplification
function perpendicularDist(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  if (dx === 0 && dy === 0) {
    return Math.hypot(p[0] - a[0], p[1] - a[1])
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function rdp(pts: number[][], tolerance: number): number[][] {
  if (pts.length <= 2) return pts
  let maxDist = 0, maxIdx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > tolerance) {
    const left = rdp(pts.slice(0, maxIdx + 1), tolerance)
    const right = rdp(pts.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0], pts[pts.length - 1]]
}

function simplifyRing(ring: number[][], tolerance: number): number[][] {
  const simplified = rdp(ring, tolerance)
  if (simplified.length > 0 && (simplified[0][0] !== simplified[simplified.length-1][0] || simplified[0][1] !== simplified[simplified.length-1][1])) {
    simplified.push(simplified[0])
  }
  return simplified.length >= 4 ? simplified : ring
}

function simplifyGeometry(geom: Polygon | MultiPolygon, tolerance: number): Polygon | MultiPolygon {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(ring => simplifyRing(ring, tolerance)) }
  }
  return {
    ...geom,
    coordinates: geom.coordinates.map(poly => poly.map(ring => simplifyRing(ring, tolerance)))
  }
}

const VALHALLA_BASE = (import.meta.env.VITE_VALHALLA_URL as string | undefined) ?? 'http://127.0.0.1:8002'

// Timeout scales with max range: base 20s + 5s per hour
function requestTimeout(maxRangeSec: number): number {
  return 20000 + (maxRangeSec / 3600) * 5000
}

let abortController: AbortController | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null

export function cancelFetch(): void {
  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
  abortController?.abort()
  abortController = null
}

export async function fetchIsochrones(
  point: [number, number],
  mode: TransportMode,
  ranges: number[],
  _onPartial?: (partial: FeatureCollection) => void
): Promise<FeatureCollection> {
  const sorted = [...ranges].sort((a, b) => a - b)
  const maxRange = sorted[sorted.length - 1]
  const { generalize, denoise } = adaptiveParams(maxRange)
  const contours = sorted.map((s) => ({ time: s / 60 }))

  const body = JSON.stringify({
    locations: [{ lon: point[0], lat: point[1] }],
    costing: COSTING_MAP[mode],
    contours,
    polygons: true,
    denoise,
    generalize
  })

  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
  abortController?.abort()
  abortController = new AbortController()

  const timeout = requestTimeout(maxRange)
  timeoutId = setTimeout(() => {
    abortController?.abort()
    abortController = null
    timeoutId = null
  }, timeout)

  console.log(`[Valhalla] POST isochrone max=${maxRange}s gen=${generalize} den=${denoise} timeout=${timeout}ms`)

  let response: Response
  try {
    response = await fetch(`${VALHALLA_BASE}/isochrone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
      body,
      signal: abortController.signal
    })
  } catch (err) {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
    if ((err as Error).name === 'AbortError') throw new Error('Computation timed out — try a shorter range or fewer contours')
    console.error('[Valhalla] fetch error:', err)
    throw new Error(`Network error: ${err}`)
  }

  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
  console.log('[Valhalla] Response status:', response.status)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    let msg = `Valhalla error ${response.status}`
    try {
      const parsed = JSON.parse(errText)
      if (parsed.error) msg = `Valhalla ${parsed.error_code}: ${parsed.error}`
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  const geojson: FeatureCollection = await response.json()
  const colors = getIsochroneColors(mode)

  // Valhalla returns features sorted ascending (smallest first) — reverse so largest renders behind
  const reversed = [...geojson.features].reverse()
  const features: Feature<Polygon | MultiPolygon>[] = reversed.map((f, i) => {
    const geom = f.geometry as Polygon | MultiPolygon
    const contourMin = f.properties?.contour as number | undefined
    const rangeSec = contourMin != null ? contourMin * 60 : sorted[reversed.length - 1 - i]
    return {
      ...(f as Feature<Polygon | MultiPolygon>),
      id: i,
      geometry: simplifyGeometry(geom, 0.001),
      properties: {
        ...f.properties,
        isoColor: colors[i % colors.length],
        isoOpacity: Math.min(0.18 + i * 0.04, 0.55),
        isoIndex: i,
        isoLabel: formatDuration(rangeSec)
      }
    }
  })

  return { type: 'FeatureCollection', features } as FeatureCollection
}
