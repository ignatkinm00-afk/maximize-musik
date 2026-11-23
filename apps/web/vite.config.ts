import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE задаётся в GitHub Actions: /<имя-репозитория>/
const base = process.env.VITE_BASE || '/';
const apiTarget = `http://localhost:${process.env.API_PORT || 8787}`;

export default defineConfig({
  base,
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/media': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Maximize Musik',
        short_name: 'Maximize',
        description: 'Музыка без подписки — телефон, Windows и Telegram',
        lang: 'ru',
        theme_color: '#06060a',
        background_color: '#06060a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Поиск', url: `${base}#/search`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Моя музыка', url: `${base}#/library`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maximize-media',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
              rangeRequests: true,
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
