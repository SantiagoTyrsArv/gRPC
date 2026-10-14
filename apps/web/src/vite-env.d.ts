/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública del backend (Railway en producción). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
