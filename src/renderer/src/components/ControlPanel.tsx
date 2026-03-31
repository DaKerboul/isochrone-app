import { useRef, useState, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useAppStore, type TransportMode } from '../store/useAppStore'
import { fetchIsochrones, cancelFetch } from '../api/ors'
import { searchPlace, type NominatimResult } from '../utils/geocoder'
import { exportPng, exportGeoJSON } from '../utils/export'
import { TimeRangeEditor } from './TimeRangeEditor'

const MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'auto', label: 'Car', icon: '🚗' },
  { value: 'bicycle', label: 'Bike', icon: '🚴' },
  { value: 'pedestrian', label: 'Walk', icon: '🚶' }
]

interface ControlPanelProps {
  mapRef: React.MutableRefObject<maplibregl.Map | null>
}

export function ControlPanel({ mapRef }: ControlPanelProps): React.JSX.Element {
  const {
    point, mode, timeRanges, isochrones, loading, error,
    valhallaStatus, history,
    setPoint, setMode, setIsochrones, setLoading, setError,
    addToast, addToHistory, restoreHistory,
    autoRecalculate, setAutoRecalculate
  } = useAppStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = (q: string): void => {
    setQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) { setResults([]); setShowDropdown(false); return }
    searchTimer.current = setTimeout(async () => {
      const r = await searchPlace(q)
      setResults(r)
      setShowDropdown(r.length > 0)
    }, 350)
  }

  const selectResult = (r: NominatimResult): void => {
    const lng = parseFloat(r.lon)
    const lat = parseFloat(r.lat)
    setPoint([lng, lat])
    setQuery(r.display_name.split(',').slice(0, 2).join(',').trim())
    setShowDropdown(false)
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 9 })
  }

  const handleCalculate = async (): Promise<void> => {
    if (!point) { setError('Click on the map to set a starting point.'); return }
    cancelFetch()
    setError(null)
    setLoading(true)
    const t0 = Date.now()
    try {
      const data = await fetchIsochrones(point, mode, timeRanges)
      setIsochrones(data)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      addToast({ message: `Computed in ${elapsed}s`, type: 'success', duration: 3000 })
      addToHistory({ point, mode, timeRanges, isochrones: data, timestamp: Date.now(), label: query || undefined })
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      addToast({ message: msg, type: 'error', duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  // Keyboard shortcut: Enter to calculate
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement) && !loading) {
        handleCalculate()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [point, mode, timeRanges, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = valhallaStatus === 'ready' ? 'Engine ready' : valhallaStatus === 'starting' ? 'Starting...' : 'Engine error'

  return (
    <aside className="control-panel">
      <div className="panel-header">
        <h1 className="panel-title">ISOCHRONE</h1>
        <div className="panel-header-right">
          {isochrones && (
            <button
              className="btn-share"
              title="Copy shareable link"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                addToast({ message: 'Link copied!', type: 'success', duration: 2000 })
              }}
            >🔗</button>
          )}
          <span className={`status-dot status-dot--${valhallaStatus}`} title={statusLabel} />
        </div>
      </div>

      {/* Search */}
      <section className="panel-section">
        <label className="section-label">Starting point</label>
        <div className="search-wrap">
          <input
            type="text"
            className="input-text"
            placeholder="Search for a place..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {showDropdown && (
            <ul className="search-dropdown">
              {results.map((r) => (
                <li key={r.place_id} onMouseDown={() => selectResult(r)}>{r.display_name}</li>
              ))}
            </ul>
          )}
        </div>
        {point ? (
          <div className="coord-row">
            <span className="coord-text">📍 {point[1].toFixed(5)}, {point[0].toFixed(5)}</span>
            <button
              className="btn-copy"
              title="Copy coordinates"
              onClick={() => {
                navigator.clipboard.writeText(`${point[1].toFixed(6)}, ${point[0].toFixed(6)}`)
                addToast({ message: 'Coordinates copied', type: 'info', duration: 2000 })
              }}
            >⎘</button>
            <button className="btn-clear" title="Clear point" onClick={() => { setPoint(null); setIsochrones(null); setQuery('') }}>✕</button>
          </div>
        ) : (
          <p className="hint">or click directly on the map</p>
        )}
      </section>

      {/* Transport mode */}
      <section className="panel-section">
        <label className="section-label">Transport mode</label>
        <div className="mode-selector">
          {MODES.map((m) => (
            <button
              key={m.value}
              data-mode={m.value}
              className={`btn-mode${mode === m.value ? ' active' : ''}`}
              onClick={() => setMode(m.value)}
            >
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-label">{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Time ranges */}
      <section className="panel-section">
        <label className="section-label">Travel times (hours)</label>
        <TimeRangeEditor />
      </section>

      {/* Calculate */}
      <section className="panel-section">
        <button className="btn-primary" onClick={handleCalculate} disabled={loading}>
          {loading ? '⏳ Computing...' : '⚡ Compute isochrones'}
        </button>
        <label className="auto-recalc-toggle">
          <input
            type="checkbox"
            checked={autoRecalculate}
            onChange={(e) => setAutoRecalculate(e.target.checked)}
          />
          <span>Auto-recalculate</span>
        </label>
        {error && (
          <div className="error-card">
            <span className="error-icon">⚠</span>
            <div className="error-body">
              <p className="error-title">Computation error</p>
              <p className="error-detail">{error}</p>
            </div>
            <button className="btn-retry" onClick={handleCalculate}>↺</button>
          </div>
        )}
      </section>

      {/* Export */}
      {isochrones && (
        <section className="panel-section">
          <label className="section-label">Export</label>

          <div className="export-row">
            <button className="btn-secondary" onClick={() => mapRef.current && exportPng(mapRef.current)}>📸 PNG</button>
            <button className="btn-secondary" onClick={() => exportGeoJSON(isochrones)}>📄 GeoJSON</button>
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="panel-section">
          <button className="history-toggle" onClick={() => setHistoryOpen((v) => !v)}>
            <span>History</span>
            <span>{historyOpen ? '▾' : '▸'}</span>
          </button>
          <div className={`collapsible-body${historyOpen ? ' open' : ''}`}>
            <div className="history-list">
              {history.map((h) => (
                <button key={h.id} className="history-item" onClick={() => { restoreHistory(h); addToast({ message: 'Calculation restored', type: 'info', duration: 2000 }) }}>
                  <span className="history-icon">{MODES.find((m) => m.value === h.mode)?.icon}</span>
                  <span className="history-label">{h.label ?? `${h.point[1].toFixed(3)}, ${h.point[0].toFixed(3)}`}</span>
                  <span className="history-meta">{h.timeRanges.length} range{h.timeRanges.length > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </aside>
  )
}
