import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
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
        // The Hub's Phaser chunk is a large lazy file (1.40 MB): precache it and uma-art's atlases too, so the map works
        // offline after install. uma-rpg's limit, with headroom over the default 2 MiB that a Phaser update could pass.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
    // uma-kit's peers resolve to this app's copies (also when the kit is linked from uma-platform to try a change).
    dedupe: ['react', 'react-dom', 'react-router', 'motion', 'phaser'],
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
  test: {
    // The kit's device keys under uma-racer's prefix in every test, as `main.tsx` sets them (app/kit.ts).
    setupFiles: ['./src/__fixtures__/kit-setup.ts'],
    // uma-kit runs through Vite in tests, so a test can stand in for the Hub's lazy Phaser game inside it (hub.test.tsx).
    server: { deps: { inline: ['@luismlorenzana/uma-kit'] } },
  },
})
