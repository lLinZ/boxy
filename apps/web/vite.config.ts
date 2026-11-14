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
        // App shell precacheado: la app abre sin internet en cualquier pantalla.
        // Las ventas sin conexión van a una cola en IndexedDB (src/lib/offline.ts).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/storage/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Consultas de la API: primero la red; sin conexión, la última respuesta
            // guardada (inventario, clientes, ventas, tasas, panel…). Se borra al
            // cerrar o iniciar sesión (limpiarDatosLocales). Nunca se guardan
            // respaldos, PDF, comprobantes de pago ni el escáner.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              !/\/(respaldos|pdf|comprobante|scanner|logout|config)(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'boxy-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 400, maxAgeSeconds: 14 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          { urlPattern: /\/api\//, handler: 'NetworkOnly' },
          {
            // Fotos de productos
            urlPattern: /\/storage\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'boxy-imagenes', expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,ico,woff,woff2,webmanifest}'],
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
