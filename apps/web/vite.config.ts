import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = (process.env.VITE_APP_BUILD_ID ?? process.env.GITHUB_SHA ?? 'local').slice(0, 12)

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Uma Racer',
        short_name: 'Uma Racer',
        description: 'Personal racing RPG',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#edf1f6',
        theme_color: '#edf1f6',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // /__/ is Firebase Hosting's reserved space (auth handler for redirect sign-in) — never answer it with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
        // Private content packs are content-hashed: cache forever on the device once downloaded. Generation 2 caches
        // under its own name, so the first-boot wipe's `caches.delete('racer-content')` takes only the old app's files
        // and never what this app has just fetched (rearchitecture/07 §2).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/content/files/'),
            handler: 'CacheFirst',
            options: { cacheName: 'uma-racer-g2-content', expiration: { maxEntries: 4000 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // `host: true` exposes the dev server on the LAN so the iPhone can load it directly.
    host: true,
    proxy: {
      // API_PROXY_TARGET lets a second dev server run beside another checkout's (another agent's on 8080).
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    // scripts/check-size.mjs reads the manifest to find the entry's static imports (D337).
    manifest: true,
  },
})
