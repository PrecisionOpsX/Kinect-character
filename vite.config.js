import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',  // Force bind to local loopback, bypassing VPN routing
    port: 5173,         // You can change this if needed (e.g., 4000 or 3000)
    strictPort: true,   // Avoid auto-switching ports if one is busy
  },
})
