import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Identifies this build. It is baked into the app and also written to
// version.json, so a page that is still open (or was served from the browser's
// cache) can tell that a newer deployment exists. See src/hooks/useUpdateAvailable.ts.
const buildId = `${Date.now()}`

const emitVersionFile: Plugin = {
  name: 'emit-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionFile],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
})
