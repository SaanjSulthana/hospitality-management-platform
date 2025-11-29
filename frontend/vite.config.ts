import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      '~backend/client': fileURLToPath(new URL('./client.ts', import.meta.url)),
      '~backend': fileURLToPath(new URL('../backend', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
  mode: "development",
  build: {
    // Enable minification for production builds
    minify: true,
  },
  define: {
    // Define environment variables for browser compatibility
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || 'http://localhost:4000'),
  },
  envPrefix: 'VITE_',
  server: {
    // Increase request size limit for development server
    // Note: Vite doesn't support bodySizeLimit directly
    // This is handled by the backend
    proxy: {
          // Telemetry endpoints → backend (avoid 404 on Vite dev server)
          '/telemetry': {
            target: 'http://127.0.0.1:4000',
            changeOrigin: true,
            followRedirects: true,
          },
          '/v1/system/telemetry': {
            target: 'http://127.0.0.1:4000',
            changeOrigin: true,
            followRedirects: true,
          },
      // Same-origin the finance realtime endpoints to reduce CORS preflights in dev
      '/finance/realtime': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // WebSocket streaming endpoint (Encore realtime v2)
      '/v2/realtime/stream': {
        // Match Encore dev server bind address exactly to avoid ECONNRESET during proxy upgrade
        target: 'http://127.0.0.1:4000',
        ws: true,
        changeOrigin: true,
        secure: false,
        followRedirects: true,
      },
    },
  },
})
