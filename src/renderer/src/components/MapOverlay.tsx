import { useAppStore } from '../store/useAppStore'

export function MapOverlay(): React.JSX.Element | null {
  const loading = useAppStore((s) => s.loading)
  if (!loading) return null
  return (
    <div className="map-loading-overlay">
      <div className="map-loading-bar" />
    </div>
  )
}
