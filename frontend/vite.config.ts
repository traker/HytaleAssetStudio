import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Dev-time backend port. Override with HAS_API_PORT.
  // Example (PowerShell): $env:HAS_API_PORT=8000; npm --prefix frontend run dev
  plugins: [react()],
  server: {
    host: process.env.HAS_WEB_HOST ?? '127.0.0.1',
    port: Number(process.env.HAS_WEB_PORT ?? '5173'),
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.HAS_API_PORT ?? '8000'}`,
        changeOrigin: true,
      },
    },
  },
})
