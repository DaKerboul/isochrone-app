/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VALHALLA_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
