import { useAppStore } from '../store/useAppStore'
import { formatDuration, getIsochroneColors } from '../api/ors'

export function Legend(): React.JSX.Element | null {
  const { isochrones, timeRanges, mode, hiddenLayers, toggleLayer } = useAppStore()
  if (!isochrones || isochrones.features.length === 0) return null

  const sorted = [...timeRanges].sort((a, b) => a - b)
  const colors = getIsochroneColors(mode)

  return (
    <div className="legend">
      {sorted.map((t, i) => (
        <div
          key={t}
          className={`legend-item${hiddenLayers.has(i) ? ' hidden' : ''}`}
          onClick={() => toggleLayer(i)}
          title={hiddenLayers.has(i) ? 'Show' : 'Hide'}
        >
          <span className="legend-swatch" style={{ background: colors[i % colors.length] }} />
          <span className="legend-label">{formatDuration(t)}</span>
          <button className="legend-eye" onClick={(e) => { e.stopPropagation(); toggleLayer(i) }}>
            {hiddenLayers.has(i) ? '🚫' : '👁'}
          </button>
        </div>
      ))}
    </div>
  )
}
