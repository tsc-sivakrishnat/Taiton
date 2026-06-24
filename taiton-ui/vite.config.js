import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../cpanel-be/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://cpanel-qzpv.onrender.com',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://cpanel-qzpv.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
