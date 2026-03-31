import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      valhallaFetch: (url: string, body: string) => Promise<string>
      valhallaAbort: () => Promise<void>
      getValhallaStatus: () => Promise<'ready' | 'starting' | 'error'>
      onValhallaStatus: (cb: (status: 'ready' | 'starting' | 'error') => void) => void
    }
  }
}
