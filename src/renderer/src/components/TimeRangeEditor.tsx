import { useAppStore } from '../store/useAppStore'
import { formatDuration, getIsochroneColors } from '../api/ors'

const PRESETS = [
  { label: '15-30-60', ranges: [900, 1800, 3600] },
  { label: '1h-2h-4h-8h', ranges: [3600, 7200, 14400, 28800] },
  { label: 'Road trip', ranges: [14400, 21600, 28800, 36000] },
  { label: '30m-1h-2h', ranges: [1800, 3600, 7200] },
]

export function TimeRangeEditor(): React.JSX.Element {
  const { timeRanges, mode, setTimeRanges } = useAppStore()
  const colors = getIsochroneColors(mode)
  const sorted = [...timeRanges].sort((a, b) => a - b)

  const update = (index: number, hours: number): void => {
    const sec = Math.min(28800, Math.max(1800, Math.round(hours * 2) / 2 * 3600))
    const next = sorted.map((v, i) => (i === index ? sec : v)).sort((a, b) => a - b)
    setTimeRanges(next)
  }

  const remove = (index: number): void => {
    if (sorted.length <= 1) return
    setTimeRanges(sorted.filter((_, i) => i !== index))
  }

  const add = (): void => {
    if (sorted.length >= 8) return
    const next = Math.min(28800, Math.max(...sorted) + 3600)
    if (next === Math.max(...sorted)) return
    setTimeRanges([...sorted, next])
  }

  return (
    <div className="time-ranges">
      <div className="preset-chips">
        {PRESETS.map((p) => (
          <button key={p.label} className="preset-chip" onClick={() => setTimeRanges(p.ranges)}>
            {p.label}
          </button>
        ))}
      </div>

      {sorted.map((t, i) => (
        <div key={i} className="time-range-row">
          <span className="range-dot" style={{ background: colors[i % colors.length] }} />
          <input
            type="number"
            className="range-input"
            min={0.5}
            max={8}
            step={0.5}
            value={t / 3600}
            onChange={(e) => update(i, parseFloat(e.target.value) || 0.5)}
          />
          <span className="range-preview">h — {formatDuration(t)}</span>
          <button className="btn-icon" onClick={() => remove(i)} disabled={sorted.length <= 1} title="Remove">×</button>
        </div>
      ))}

      {sorted.length < 8 && Math.max(...sorted) < 28800 && (
        <button className="btn-add" onClick={add}>+ Add a duration</button>
      )}
    </div>
  )
}
