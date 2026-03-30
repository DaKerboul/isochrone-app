import { useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapView } from './components/Map'
import { ControlPanel } from './components/ControlPanel'
import { Legend } from './components/Legend'

function App(): React.JSX.Element {
  const mapRef = useRef<maplibregl.Map | null>(null)

  return (
    <div className="app-layout">
      <ControlPanel mapRef={mapRef} />
      <div className="map-wrapper">
        <MapView mapRef={mapRef} />
        <Legend />
      </div>
    </div>
  )
}

export default App
