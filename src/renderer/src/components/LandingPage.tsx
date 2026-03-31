import { useState } from 'react'

interface Props { onStart: () => void }

export function LandingPage({ onStart }: Props): React.JSX.Element {
  const [leaving, setLeaving] = useState(false)

  const handleStart = (): void => {
    setLeaving(true)
    setTimeout(onStart, 420)
  }

  return (
    <div className={`landing${leaving ? ' landing--out' : ''}`}>
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />
      <div className="landing-blob landing-blob-3" />

      <div className="landing-rings">
        <div className="landing-ring" />
        <div className="landing-ring" />
        <div className="landing-ring" />
        <div className="landing-ring" />
      </div>

      <div className="landing-content">
        <div className="landing-badge">Powered by Valhalla · OpenStreetMap</div>
        <h1 className="landing-title">ISOCHRONE</h1>
        <p className="landing-sub">
          Visualize how far you can travel from any point in France — by car, bike, or on foot.
        </p>
        <div className="landing-modes">
          <span className="landing-mode-chip landing-mode-auto">🚗 Drive</span>
          <span className="landing-mode-chip landing-mode-bike">🚴 Bike</span>
          <span className="landing-mode-chip landing-mode-walk">🚶 Walk</span>
        </div>
        <button className="landing-cta" onClick={handleStart}>
          Start Exploring →
        </button>
      </div>
    </div>
  )
}
