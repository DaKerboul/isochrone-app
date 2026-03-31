import type { Feature } from 'geojson'
import { useAppStore } from '../store/useAppStore'
import { formatDuration, getIsochroneColors } from '../api/ors'

function ringAreaKm2(coords: number[][]): number {
  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coords[i][0] * coords[j][1]
    area -= coords[j][0] * coords[i][1]
  }
  area = Math.abs(area) / 2
  const midLat = (coords.reduce((s, c) => s + c[1], 0) / coords.length) * (Math.PI / 180)
  return area * 111.32 * 111.32 * Math.cos(midLat)
}

function featureAreaKm2(f: Feature): number {
  const g = f.geometry
  if (g.type === 'Polygon') return ringAreaKm2(g.coordinates[0])
  if (g.type === 'MultiPolygon') return g.coordinates.reduce((s, p) => s + ringAreaKm2(p[0]), 0)
  return 0
}

function formatArea(km2: number): string {
  if (km2 >= 1000) return `${(km2 / 1000).toFixed(1)}k km²`
  return `${Math.round(km2).toLocaleString()} km²`
}

export function Legend(): React.JSX.Element | null {
  const { isochrones, timeRanges, mode, hiddenLayers, toggleLayer } = useAppStore()
  if (!isochrones || isochrones.features.length === 0) return null

  const sorted = [...timeRanges].sort((a, b) => a - b)
  const colors = getIsochroneColors(mode)

  const areaByIndex = new Map<number, number>()
  isochrones.features.forEach((f) => {
    const idx = f.properties?.isoIndex as number | undefined
    if (idx !== undefined) areaByIndex.set(idx, featureAreaKm2(f))
  })

  return (
    <div className="legend">
      <div className="legend-title">Reachable zones</div>
      {sorted.map((t, i) => {
        const area = areaByIndex.get(i)
        return (
          <div
            key={t}
            className={`legend-item${hiddenLayers.has(i) ? ' hidden' : ''}`}
            onClick={() => toggleLayer(i)}
            title={hiddenLayers.has(i) ? 'Show' : 'Hide'}
          >
            <span className="legend-swatch" style={{ background: colors[i % colors.length] }} />
            <span className="legend-label">{formatDuration(t)}</span>
            {area !== undefined && <span className="legend-area">{formatArea(area)}</span>}
            <button className="legend-eye" onClick={(e) => { e.stopPropagation(); toggleLayer(i) }}>
              {hiddenLayers.has(i) ? '🚫' : '👁'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
