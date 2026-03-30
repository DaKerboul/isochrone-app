import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'

export type TransportMode = 'driving-car' | 'cycling-regular' | 'foot-walking'

interface AppState {
  point: [number, number] | null
  mode: TransportMode
  timeRanges: number[]
  isochrones: FeatureCollection | null
  loading: boolean
  error: string | null
  orsApiKey: string
  setPoint: (point: [number, number] | null) => void
  setMode: (mode: TransportMode) => void
  setTimeRanges: (ranges: number[]) => void
  setIsochrones: (iso: FeatureCollection | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setOrsApiKey: (key: string) => void
}

const STORAGE_KEY = 'ors_api_key'

export const useAppStore = create<AppState>((set) => ({
  point: null,
  mode: 'driving-car',
  timeRanges: [1200, 2400, 3600], // 20min, 40min, 1h
  isochrones: null,
  loading: false,
  error: null,
  orsApiKey:
    localStorage.getItem(STORAGE_KEY) ??
    (import.meta.env.VITE_ORS_API_KEY as string | undefined) ??
    '',
  setPoint: (point) => set({ point }),
  setMode: (mode) => set({ mode }),
  setTimeRanges: (timeRanges) => set({ timeRanges }),
  setIsochrones: (isochrones) => set({ isochrones }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setOrsApiKey: (key) => {
    localStorage.setItem(STORAGE_KEY, key)
    set({ orsApiKey: key })
  }
}))
