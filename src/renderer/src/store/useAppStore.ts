import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'

export type TransportMode = 'auto' | 'bicycle' | 'pedestrian'

interface AppState {
  point: [number, number] | null
  mode: TransportMode
  timeRanges: number[] // seconds
  isochrones: FeatureCollection | null
  loading: boolean
  error: string | null
  valhallaUrl: string
  setPoint: (point: [number, number] | null) => void
  setMode: (mode: TransportMode) => void
  setTimeRanges: (ranges: number[]) => void
  setIsochrones: (iso: FeatureCollection | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setValhallaUrl: (url: string) => void
}

const URL_KEY = 'valhalla_url'
const DEFAULT_URL = (import.meta.env.VITE_VALHALLA_URL as string | undefined) ?? 'https://routing.kerboul.me'

export const useAppStore = create<AppState>((set) => ({
  point: null,
  mode: 'auto',
  timeRanges: [3600, 7200, 14400], // 1h, 2h, 4h
  isochrones: null,
  loading: false,
  error: null,
  valhallaUrl: localStorage.getItem(URL_KEY) ?? DEFAULT_URL,
  setPoint: (point) => set({ point }),
  setMode: (mode) => set({ mode }),
  setTimeRanges: (timeRanges) => set({ timeRanges }),
  setIsochrones: (isochrones) => set({ isochrones }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setValhallaUrl: (url) => {
    localStorage.setItem(URL_KEY, url)
    set({ valhallaUrl: url })
  }
}))
