/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server runs the SPA only. It does NOT run the /api serverless functions —
// use `vercel dev` for that (see README). Port 3000 matches Vercel's local port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  test: {
    // Handlers are Node code, so the tests run in a Node environment (no DOM).
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
