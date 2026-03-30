import type { Map as MaplibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

export function exportPng(map: MaplibreMap, filename = 'isochrone.png'): void {
  const url = map.getCanvas().toDataURL('image/png')
  triggerDownload(url, filename)
}

export function exportGeoJSON(data: FeatureCollection, filename = 'isochrone.geojson'): void {
  // Strip internal display props before exporting
  const clean: FeatureCollection = {
    ...data,
    features: data.features.map((f) => ({
      ...f,
      properties: Object.fromEntries(
        Object.entries(f.properties ?? {}).filter(([k]) => !k.startsWith('iso'))
      )
    }))
  }
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
