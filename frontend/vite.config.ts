import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Dev-time backend port. Override with HAS_API_PORT.
  // Example (PowerShell): $env:HAS_API_PORT=8000; npm --prefix frontend run dev
  plugins: [react()],
  build: {
    // The Studio is a local-only tool with a few legitimately heavy editor deps.
    // Keep the warning signal meaningful by splitting the main vendors first and
    // then tolerating a larger lazy chunk for Monaco-based editing.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('@monaco-editor/react') || id.includes('monaco-editor')) {
            return 'monaco-editor'
          }
          if (id.includes('@xyflow/react')) {
            return 'react-flow'
          }
          if (id.includes('elkjs')) {
            return 'elk-layout'
          }
          if (id.includes('/dagre') || id.includes('\\dagre\\')) {
            return 'dagre-layout'
          }
          if (id.includes('react-dom') || id.includes('react/') || id.includes('\\react\\') || id.includes('/scheduler/')) {
            return 'react-vendor'
          }
          return 'vendor'
        },
      },
    },
  },
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
