import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// La web (dev en :5173) habla con la API Laravel (:8000) vía proxy → sin CORS.
// Modo `lan` (npm run lan): expone el server en la red local con HTTPS
// autofirmado — requisito de los navegadores móviles para abrir la cámara.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'lan' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Boxy — Punto de venta e inventario',
        short_name: 'Boxy',
        description: 'Cobra en divisas y bolívares: punto de venta, inventario y control de IVA, IGTF y tasa BCV.',
        lang: 'es',
        theme_color: '#161918',
        background_color: '#0b0b0f',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell precacheado; las llamadas a la API siempre van a la red.
        // El modo sin conexión del POS guarda catálogo y ventas pendientes en
        // IndexedDB (src/lib/offline.ts), no en la caché del service worker.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // En desarrollo NO registramos service worker: evita servir bundles viejos
      // cacheados. La PWA (SW + precache) solo se activa en el build de producción.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Fotos de productos servidas por Laravel (storage:link)
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}))
