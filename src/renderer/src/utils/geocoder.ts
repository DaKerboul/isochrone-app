export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string]
}

export async function searchPlace(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr,en' } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
