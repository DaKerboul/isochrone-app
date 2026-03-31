import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  valhallaFetch: (url: string, body: string): Promise<string> =>
    ipcRenderer.invoke('valhalla-fetch', url, body),
  valhallaAbort: (): Promise<void> =>
    ipcRenderer.invoke('valhalla-abort'),
  getValhallaStatus: (): Promise<'ready' | 'starting' | 'error'> =>
    ipcRenderer.invoke('valhalla-status'),
  onValhallaStatus: (cb: (status: 'ready' | 'starting' | 'error') => void): void => {
    ipcRenderer.on('valhalla-status', (_e, status) => cb(status))
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
