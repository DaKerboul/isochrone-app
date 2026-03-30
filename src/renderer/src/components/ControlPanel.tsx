import { useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { useAppStore, type TransportMode } from '../store/useAppStore'
import { fetchIsochrones } from '../api/ors'
import { searchPlace, type NominatimResult } from '../utils/geocoder'
import { exportPng, exportGeoJSON } from '../utils/export'
import { TimeRangeEditor } from './TimeRangeEditor'

const MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'driving-car', label: 'Voiture', icon: '🚗' },
  { value: 'cycling-regular', label: 'Vélo', icon: '🚴' },
  { value: 'foot-walking', label: 'Piéton', icon: '🚶' }
]

interface ControlPanelProps {
  mapRef: React.MutableRefObject<maplibregl.Map | null>
}

export function ControlPanel({ mapRef }: ControlPanelProps): React.JSX.Element {
  const {
    point,
    mode,
    timeRanges,
    isochrones,
    loading,
    error,
    orsApiKey,
    setPoint,
    setMode,
    setIsochrones,
    setLoading,
    setError,
    setOrsApiKey
  } = useAppStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showApiKey, setShowApiKey] = useState(!orsApiKey)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = (q: string): void => {
    setQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
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
    if (!point) {
      setError('Cliquez sur la carte pour définir un point de départ.')
      return
    }
    if (!orsApiKey.trim()) {
      setError('Clé API ORS manquante.')
      setShowApiKey(true)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await fetchIsochrones(point, mode, timeRanges, orsApiKey)
      setIsochrones(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="control-panel">
      <div className="panel-header">
        <h1 className="panel-title">🗺️ Isochrone Map</h1>
      </div>

      {/* Search */}
      <section className="panel-section">
        <label className="section-label">Point de départ</label>
        <div className="search-wrap">
          <input
            type="text"
            className="input-text"
            placeholder="Rechercher un lieu..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {showDropdown && (
            <ul className="search-dropdown">
              {results.map((r) => (
                <li key={r.place_id} onMouseDown={() => selectResult(r)}>
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {point ? (
          <div className="coord-row">
            <span className="coord-text">
              📍 {point[1].toFixed(5)}, {point[0].toFixed(5)}
            </span>
            <button
              className="btn-clear"
              title="Effacer le point"
              onClick={() => {
                setPoint(null)
                setIsochrones(null)
                setQuery('')
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="hint">ou cliquez directement sur la carte</p>
        )}
      </section>

      {/* Transport mode */}
      <section className="panel-section">
        <label className="section-label">Mode de transport</label>
        <div className="mode-selector">
          {MODES.map((m) => (
            <button
              key={m.value}
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
        <label className="section-label">Durées de trajet</label>
        <TimeRangeEditor />
      </section>

      {/* Calculate */}
      <section className="panel-section">
        <button className="btn-primary" onClick={handleCalculate} disabled={loading}>
          {loading ? '⏳ Calcul en cours...' : '⚡ Calculer les isochrones'}
        </button>
        {error && <p className="error-msg">⚠️ {error}</p>}
      </section>

      {/* Export */}
      {isochrones && (
        <section className="panel-section">
          <label className="section-label">Export</label>
          <div className="export-row">
            <button
              className="btn-secondary"
              onClick={() => mapRef.current && exportPng(mapRef.current)}
            >
              📸 PNG
            </button>
            <button className="btn-secondary" onClick={() => exportGeoJSON(isochrones)}>
              📄 GeoJSON
            </button>
          </div>
        </section>
      )}

      {/* API Key */}
      <section className="panel-section api-section">
        <button className="btn-link" onClick={() => setShowApiKey(!showApiKey)}>
          {showApiKey ? '▲' : '▼'} Clé API ORS
          {orsApiKey && <span className="key-ok"> ✓</span>}
        </button>
        {showApiKey && (
          <input
            type="password"
            className="input-text"
            placeholder="Clé API OpenRouteService..."
            value={orsApiKey}
            onChange={(e) => setOrsApiKey(e.target.value)}
            autoComplete="off"
          />
        )}
      </section>
    </aside>
  )
}
