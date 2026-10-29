/// <reference types="vite/client" />

// Set by vite.config.ts; the same value is published in /version.json.
declare const __APP_BUILD_ID__: string

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string
  readonly VITE_APPWRITE_PROJECT_ID: string
  readonly VITE_APPWRITE_DATABASE_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
