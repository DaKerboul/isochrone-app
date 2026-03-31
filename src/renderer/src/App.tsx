import { useEffect, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapView } from './components/Map'
import { ControlPanel } from './components/ControlPanel'
import { Legend } from './components/Legend'
import { Toast } from './components/Toast'
import { MapOverlay } from './components/MapOverlay'
import { LandingPage } from './components/LandingPage'
import { useAppStore } from './store/useAppStore'
import { fetchIsochrones, cancelFetch } from './api/ors'
import type { TransportMode } from './store/useAppStore'

function App(): React.JSX.Element {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const valhallaStatus = useAppStore((s) => s.valhallaStatus)
  const setValhallaStatus = useAppStore((s) => s.setValhallaStatus)
  const autoRecalculate = useAppStore((s) => s.autoRecalculate)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const point = useAppStore((s) => s.point)
  const mode = useAppStore((s) => s.mode)
  const timeRanges = useAppStore((s) => s.timeRanges)

  const hasHash = !!window.location.hash
  const [showLanding, setShowLanding] = useState(() => !sessionStorage.getItem('seen') && !hasHash)

  // Restore from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    try {
      const parts = hash.split('/')
      if (parts.length < 3) return
      const [lat, lng] = parts[0].split(',').map(Number)
      const modeStr = parts[1]
      const ranges = parts[2].split('-').map(Number)
      const { setPoint, setMode, setTimeRanges } = useAppStore.getState()
      if (!isNaN(lat) && !isNaN(lng)) setPoint([lng, lat])
      if (['auto', 'bicycle', 'pedestrian'].includes(modeStr)) setMode(modeStr as TransportMode)
      if (ranges.length > 0 && ranges.every((r) => !isNaN(r) && r > 0)) setTimeRanges(ranges)
    } catch { /* ignore malformed hash */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state to URL hash
  useEffect(() => {
    if (!point) return
    const sorted = [...timeRanges].sort((a, b) => a - b)
    const hash = `#${point[1].toFixed(5)},${point[0].toFixed(5)}/${mode}/${sorted.join('-')}`
    window.history.replaceState(null, '', hash)
  }, [point, mode, timeRanges])

  // Get Valhalla status — IPC in Electron, fetch poll in web
  useEffect(() => {
    if (window.api) {
      window.api.getValhallaStatus().then((s) => setValhallaStatus(s))
      window.api.onValhallaStatus((s) => setValhallaStatus(s))
      return
    }
    const base = (import.meta.env.VITE_VALHALLA_URL as string | undefined) ?? 'http://127.0.0.1:8002'
    const deadline = Date.now() + 180000
    let cancelled = false
    const poll = async (): Promise<void> => {
      while (!cancelled && Date.now() < deadline) {
        try {
          const r = await fetch(`${base}/status`, { signal: AbortSignal.timeout(2000) })
          if (r.ok) { setValhallaStatus('ready'); return }
        } catch { /* not ready yet */ }
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!cancelled) setValhallaStatus('error')
    }
    poll()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate once Valhalla is ready
  useEffect(() => {
    if (valhallaStatus !== 'ready') return
    const { point: p, mode: m, timeRanges: tr, setIsochrones, setLoading, setError } = useAppStore.getState()
    if (!p) return
    setLoading(true)
    fetchIsochrones(p, m, tr)
      .then((data) => setIsochrones(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [valhallaStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recalculate on param changes
  useEffect(() => {
    if (!autoRecalculate || valhallaStatus !== 'ready') return
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => {
      const { point: p, mode: m, timeRanges: tr, setIsochrones, setLoading, setError } = useAppStore.getState()
      if (!p) return
      cancelFetch()
      setLoading(true)
      fetchIsochrones(p, m, tr)
        .then((data) => setIsochrones(data))
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false))
    }, 800)
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (showLanding) {
    return <LandingPage onStart={() => { sessionStorage.setItem('seen', '1'); setShowLanding(false) }} />
  }

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
