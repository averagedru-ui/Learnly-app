import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This configuration allows Replit's dynamic URLs to access the dev server
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: true // This fixes the "Blocked Request" error
  },
  build: {
    outDir: 'dist',
  }
})

