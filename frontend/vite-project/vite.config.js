// frontend/vite-project/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    allowedHosts: [
      '37aa-2800-484-5f85-b600-925-358f-2ef9-db5.ngrok-free.app',
      '.ngrok-free.app' // Esto permite cualquier subdominio de ngrok
    ],
    // Si lo anterior falla, esto deshabilita la validación por completo
    hmr: {
      clientPort: 443,
    },
  },
});