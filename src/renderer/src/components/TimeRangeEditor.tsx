import { useAppStore } from '../store/useAppStore'
import { formatDuration, ISOCHRONE_COLORS } from '../api/ors'

export function TimeRangeEditor(): React.JSX.Element {
  const { timeRanges, setTimeRanges } = useAppStore()
  const sorted = [...timeRanges].sort((a, b) => a - b)

  const ORS_MAX_SEC = 3600

  const update = (index: number, minutes: number): void => {
    const sec = Math.min(ORS_MAX_SEC, Math.max(60, Math.round(minutes) * 60))
    const next = sorted.map((v, i) => (i === index ? sec : v)).sort((a, b) => a - b)
    setTimeRanges(next)
  }

  const remove = (index: number): void => {
    if (sorted.length <= 1) return
    setTimeRanges(sorted.filter((_, i) => i !== index))
  }

  const add = (): void => {
    if (sorted.length >= 5) return
    const next = Math.min(ORS_MAX_SEC, Math.max(...sorted) + 600)
    if (next === Math.max(...sorted)) return // already at max
    setTimeRanges([...sorted, next])
  }

  return (
    <div className="time-ranges">
      {sorted.map((t, i) => (
        <div key={i} className="time-range-row">
          <span
            className="range-dot"
            style={{ background: ISOCHRONE_COLORS[i % ISOCHRONE_COLORS.length] }}
          />
          <input
            type="number"
            className="range-input"
            min={1}
            max={60}
            step={5}
            value={Math.round(t / 60)}
            onChange={(e) => update(i, parseInt(e.target.value) || 5)}
          />
          <span className="range-preview">min — {formatDuration(t)}</span>
          <button
            className="btn-icon"
            onClick={() => remove(i)}
            disabled={sorted.length <= 1}
            title="Supprimer"
          >
            ×
          </button>
        </div>
      ))}
      {sorted.length < 5 && Math.max(...sorted) < ORS_MAX_SEC && (
        <button className="btn-add" onClick={add}>
          + Ajouter une durée
        </button>
      )}
      <p className="hint">Max 60 min — limite API ORS gratuit</p>
    </div>
  )
}
