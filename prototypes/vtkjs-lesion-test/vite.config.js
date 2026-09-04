import { defineConfig } from 'vite'

// vtk.js ships raw .glsl shader source files that it imports as plain
// strings. Vite/esbuild has no default loader for that extension, so we
// tell esbuild (used for dependency pre-bundling) to treat .glsl as text.
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.glsl': 'text' },
    },
  },
})
