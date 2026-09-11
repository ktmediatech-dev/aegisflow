import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The subdomain (aegisflow.scholarsas.com) maps directly to this app's
  // document root — it's not served from a sub-path — so base must be '/'.
  base: '/',
  server: {
    port: 3000,
    open: true,
    proxy: {
      // The backend now serves its own API under /api (see src/index.js),
      // so no rewrite is needed — this just forwards the dev server's
      // /api/* requests straight to the Express server on :4000.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})
