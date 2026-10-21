import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.VITE_API_TARGET || 'http://localhost:4000';
// Port du serveur de dev (surchargeable via VITE_DEV_PORT).
const DEV_PORT = Number(process.env.VITE_DEV_PORT || 5180);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
});
