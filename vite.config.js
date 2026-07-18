import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), basicSsl()],
  server: {
    host: true, // Expose to local network
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  }
})
