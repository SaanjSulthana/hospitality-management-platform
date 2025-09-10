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
    minify: false,
  },
  define: {
    // Define environment variables for browser compatibility
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || 'http://localhost:4000'),
  },
  envPrefix: 'VITE_',
})
