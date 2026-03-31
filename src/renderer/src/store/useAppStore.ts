import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'

export type TransportMode = 'auto' | 'bicycle' | 'pedestrian'
export type ValhallaStatus = 'starting' | 'ready' | 'error'

export type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

export type HistoryEntry = {
  id: string
  point: [number, number]
  mode: TransportMode
  timeRanges: number[]
  isochrones: FeatureCollection
  timestamp: number
  label?: string
}

interface AppState {
  point: [number, number] | null
  mode: TransportMode
  timeRanges: number[]
  isochrones: FeatureCollection | null
  loading: boolean
  error: string | null
  valhallaStatus: ValhallaStatus

  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  history: HistoryEntry[]
  addToHistory: (e: Omit<HistoryEntry, 'id'>) => void
  restoreHistory: (e: HistoryEntry) => void

  hiddenLayers: Set<number>
  toggleLayer: (index: number) => void

  autoRecalculate: boolean
  setAutoRecalculate: (v: boolean) => void

  setPoint: (point: [number, number] | null) => void
  setMode: (mode: TransportMode) => void
  setTimeRanges: (ranges: number[]) => void
  setIsochrones: (iso: FeatureCollection | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setValhallaStatus: (s: ValhallaStatus) => void
}

export const useAppStore = create<AppState>((set) => ({
  point: [2.3522, 48.8566],
  mode: 'auto',
  timeRanges: [900, 1800, 3600],
  isochrones: null,
  loading: false,
  error: null,
  valhallaStatus: 'starting',

  toasts: [],
  addToast: (t) => set((s) => ({
    toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }]
  })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  history: [],
  addToHistory: (e) => set((s) => ({
    history: [{ ...e, id: Math.random().toString(36).slice(2) }, ...s.history].slice(0, 5)
  })),
  restoreHistory: (e) => set({
    point: e.point,
    mode: e.mode,
    timeRanges: e.timeRanges,
    isochrones: e.isochrones,
    hiddenLayers: new Set<number>()
  }),

  hiddenLayers: new Set<number>(),
  toggleLayer: (index) => set((s) => {
    const next = new Set(s.hiddenLayers)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    return { hiddenLayers: next }
  }),

  autoRecalculate: false,
  setAutoRecalculate: (autoRecalculate) => set({ autoRecalculate }),

  setPoint: (point) => set({ point }),
  setMode: (mode) => set({ mode }),
  setTimeRanges: (timeRanges) => set({ timeRanges }),
  setIsochrones: (isochrones) => set({ isochrones }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setValhallaStatus: (valhallaStatus) => set({ valhallaStatus })
}))
