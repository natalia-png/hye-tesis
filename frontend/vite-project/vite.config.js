import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // escucha en toda la red
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
