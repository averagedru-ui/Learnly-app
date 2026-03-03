import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This configuration fixes the "Blocked Host" error on Replit 
// and ensures Vercel builds to the correct folder.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: true 
  },
  build: {
    outDir: 'dist',
  }
})

