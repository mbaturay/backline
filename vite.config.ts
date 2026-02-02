import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
    // Serve the data directory for the JSON files
    fs: {
      allow: ['.', 'data']
    }
  },
  // Serve data directory as static assets
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
