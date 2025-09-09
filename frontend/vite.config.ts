import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '~backend/client': path.resolve(__dirname, './client.ts'),
      '~backend': path.resolve(__dirname, '../backend'),
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
