import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDev = mode === 'development';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
          type: 'module',
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Bulela: Grades 8-9 Math',
          short_name: 'Bulela',
          description: 'Grade 8 & 9 Zambian Math Tutor',
          theme_color: '#FDF7F2',
          background_color: '#FDF7F2',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: isDev ? [] : ['**/*.{js,css,html,ico,png,svg}'],
          navigateFallbackDenylist: [/^\/@vite\/client/, /^\/@react-refresh/], // The "Zombie" Killer
          runtimeCaching: [
            {
              urlPattern: /\.(?:woff2|woff|ttf)$/, // The "Math Fix" for KaTeX fonts
              handler: 'CacheFirst',
              options: {
                cacheName: 'math-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst', // Ensures we don't show "ghost" data if online/connected
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5, // Stability for Zambian networks
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 24 * 60 * 60, // 24 Hours
                },
              },
            },
            {
              urlPattern: ({ request }) => 
                request.destination === 'style' || 
                request.destination === 'script' || 
                request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'ui-assets',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                },
              },
            },
          ],
        },
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      host: '0.0.0.0',
    },
  };
});