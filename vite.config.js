import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This file tells Vercel how to handle the React build
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
  }
})

