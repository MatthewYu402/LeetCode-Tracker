import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One bundle is fine for an app that only ever loads from localhost.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: 5173,
    // The API runs as a separate process in development.
    proxy: { '/api': `http://127.0.0.1:${process.env.PORT ?? 3001}` },
  },
})
