import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

// Estimate how long a calculation will take based on max range (seconds)
function estimateDuration(maxRangeSec: number): number {
  // Base 1.5s + ~2s per hour of isochrone range
  return 1500 + (maxRangeSec / 3600) * 2200
}

export function MapOverlay(): React.JSX.Element | null {
  const loading = useAppStore((s) => s.loading)
  const timeRanges = useAppStore((s) => s.timeRanges)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  const estimatedRef = useRef<number>(3000)

  useEffect(() => {
    if (loading) {
      const maxRange = Math.max(...timeRanges)
      estimatedRef.current = estimateDuration(maxRange)
      startRef.current = Date.now()
      setProgress(0)
      setVisible(true)

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current
        const ratio = elapsed / estimatedRef.current
        // Ease to 88%: asymptotic curve that never quite reaches it
        const pct = 88 * (1 - Math.exp(-3 * ratio))
        setProgress(Math.min(pct, 88))
      }, 80)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      // Snap to 100% then fade out
      setProgress(100)
      const t = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 500)
      return () => clearTimeout(t)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  const pct = Math.round(progress)

  return (
    <div className="map-loading-overlay">
      <div className="map-loading-track">
        <div
          className={`map-loading-fill${progress >= 100 ? ' map-loading-fill--done' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div
        className={`map-loading-badge${progress >= 100 ? ' map-loading-badge--done' : ''}`}
        style={{ left: `clamp(32px, ${progress}%, calc(100% - 40px))` }}
      >
        {pct < 100 ? `${pct}%` : '✓'}
      </div>
    </div>
  )
}
