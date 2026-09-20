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
        background_color: '#bfe6ff',
        theme_color: '#2fa8f5',
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
        // Private content packs are content-hashed: cache forever on the device once downloaded.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/content/files/'),
            handler: 'CacheFirst',
            options: { cacheName: 'racer-content', expiration: { maxEntries: 4000 } },
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
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
  },
})
