import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapView } from './components/Map'
import { ControlPanel } from './components/ControlPanel'
import { Legend } from './components/Legend'
import { Toast } from './components/Toast'
import { MapOverlay } from './components/MapOverlay'
import { useAppStore } from './store/useAppStore'
import { fetchIsochrones, cancelFetch } from './api/ors'

function App(): React.JSX.Element {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const valhallaStatus = useAppStore((s) => s.valhallaStatus)
  const setValhallaStatus = useAppStore((s) => s.setValhallaStatus)
  const autoRecalculate = useAppStore((s) => s.autoRecalculate)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Probe Valhalla status at startup
  useEffect(() => {
    const base = (import.meta.env.VITE_VALHALLA_URL as string | undefined) ?? 'http://127.0.0.1:8002'
    fetch(`${base}/status`, { signal: AbortSignal.timeout(3000) })
      .then((r) => setValhallaStatus(r.ok ? 'ready' : 'error'))
      .catch(() => setValhallaStatus('error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate once Valhalla is ready
  useEffect(() => {
    if (valhallaStatus !== 'ready') return
    const { point, mode, timeRanges, setIsochrones, setLoading, setError } = useAppStore.getState()
    if (!point) return
    setLoading(true)
    fetchIsochrones(point, mode, timeRanges)
      .then((data) => setIsochrones(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [valhallaStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recalculate on param changes
  useEffect(() => {
    if (!autoRecalculate || valhallaStatus !== 'ready') return
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => {
      const { point, mode, timeRanges, setIsochrones, setLoading, setError } = useAppStore.getState()
      if (!point) return
      cancelFetch()
      setLoading(true)
      fetchIsochrones(point, mode, timeRanges)
        .then((data) => setIsochrones(data))
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false))
    }, 800)
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (valhallaStatus === 'starting') {
    return (
      <div className="splash">
        <div className="splash-content">
          <div className="splash-rings">
            <div className="splash-ring" />
            <div className="splash-ring" />
            <div className="splash-ring" />
          </div>
          <p>Starting routing engine...</p>
        </div>
      </div>
    )
  }

  if (valhallaStatus === 'error') {
    return (
      <div className="splash splash-error">
        <div className="splash-content">
          <p>Valhalla could not start.</p>
          <p className="splash-hint">Check that Docker is running in WSL Ubuntu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <ControlPanel mapRef={mapRef} />
      <div className="map-wrapper">
        <MapView mapRef={mapRef} />
        <MapOverlay />
        <Legend />
        <Toast />
      </div>
    </div>
  )
}

export default App
