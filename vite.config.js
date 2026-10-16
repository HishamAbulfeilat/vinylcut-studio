import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the same bundle works when served over http (web)
  // and when loaded from file:// (Electron desktop build).
  base: './',
  server: {
    port: 3000,
    host: true
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  }
})
