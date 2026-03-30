import { useAppStore } from '../store/useAppStore'
import { formatDuration, ISOCHRONE_COLORS } from '../api/ors'

export function Legend(): React.JSX.Element | null {
  const { isochrones, timeRanges } = useAppStore()
  if (!isochrones || isochrones.features.length === 0) return null

  const sorted = [...timeRanges].sort((a, b) => a - b)

  return (
    <div className="legend">
      {sorted.map((t, i) => (
        <div key={t} className="legend-item">
          <span
            className="legend-swatch"
            style={{ background: ISOCHRONE_COLORS[i % ISOCHRONE_COLORS.length] }}
          />
          <span className="legend-label">{formatDuration(t)}</span>
        </div>
      ))}
    </div>
  )
}
