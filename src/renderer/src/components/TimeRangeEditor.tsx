import { useAppStore } from '../store/useAppStore'
import { formatDuration, ISOCHRONE_COLORS } from '../api/ors'

export function TimeRangeEditor(): React.JSX.Element {
  const { timeRanges, setTimeRanges } = useAppStore()
  const sorted = [...timeRanges].sort((a, b) => a - b)

  const update = (index: number, hours: number): void => {
    const sec = Math.max(1800, Math.round(hours * 2) / 2 * 3600) // pas de 0.5h, min 30min
    const next = sorted.map((v, i) => (i === index ? sec : v)).sort((a, b) => a - b)
    setTimeRanges(next)
  }

  const remove = (index: number): void => {
    if (sorted.length <= 1) return
    setTimeRanges(sorted.filter((_, i) => i !== index))
  }

  const add = (): void => {
    if (sorted.length >= 5) return
    const next = Math.min(36000, Math.max(...sorted) + 3600)
    if (next === Math.max(...sorted)) return
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
            min={0.5}
            max={10}
            step={0.5}
            value={t / 3600}
            onChange={(e) => update(i, parseFloat(e.target.value) || 0.5)}
          />
          <span className="range-preview">h — {formatDuration(t)}</span>
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
      {sorted.length < 5 && Math.max(...sorted) < 36000 && (
        <button className="btn-add" onClick={add}>
          + Ajouter une durée
        </button>
      )}
    </div>
  )
}
