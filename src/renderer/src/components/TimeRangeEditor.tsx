import { useAppStore } from '../store/useAppStore'
import { formatDuration, ISOCHRONE_COLORS } from '../api/ors'

export function TimeRangeEditor(): React.JSX.Element {
  const { timeRanges, setTimeRanges } = useAppStore()
  const sorted = [...timeRanges].sort((a, b) => a - b)

  const update = (index: number, hours: number): void => {
    const sec = Math.max(300, Math.round(hours * 3600))
    const next = sorted.map((v, i) => (i === index ? sec : v)).sort((a, b) => a - b)
    setTimeRanges(next)
  }

  const remove = (index: number): void => {
    if (sorted.length <= 1) return
    setTimeRanges(sorted.filter((_, i) => i !== index))
  }

  const add = (): void => {
    if (sorted.length >= 5) return
    setTimeRanges([...sorted, Math.max(...sorted) + 3600])
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
            min={0.1}
            max={24}
            step={0.5}
            value={Math.round((t / 3600) * 10) / 10}
            onChange={(e) => update(i, parseFloat(e.target.value) || 0.5)}
          />
          <span className="range-preview">{formatDuration(t)}</span>
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
      {sorted.length < 5 && (
        <button className="btn-add" onClick={add}>
          + Ajouter une durée
        </button>
      )}
    </div>
  )
}
