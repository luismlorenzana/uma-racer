import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = (process.env.VITE_APP_BUILD_ID ?? process.env.GITHUB_SHA ?? 'local').slice(0, 12)

/** The new game's measure-only build (T137): `vite build --mode g2-size` builds `g2.html` into `dist-g2`, with no PWA. */
const G2_SIZE = 'g2-size'

/**
 * The new game's dev mount (T137): `/dev/g2` and `/dev/g2/*` answer with `g2.html` while serving, so the page never
 * reaches `dist` and today's entry never sees it. T143 makes the new game the entry and removes this.
 */
function g2DevMount(): Plugin {
  return {
    name: 'racer-g2-dev-mount',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if ((path === '/dev/g2' || path.startsWith('/dev/g2/')) && (req.headers.accept ?? '').includes('text/html')) req.url = '/g2.html'
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const g2Size = mode === G2_SIZE
  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      g2DevMount(),
      ...(g2Size ? [] : [VitePWA({
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
          // Private content packs are content-hashed: cache forever on the device once downloaded.
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/content/files/'),
              handler: 'CacheFirst',
              options: { cacheName: 'racer-content', expiration: { maxEntries: 4000 } },
            },
          ],
        },
      })]),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // `host: true` exposes the dev server on the LAN so the iPhone can load it directly.
      host: true,
      // The new game's measure build lands beside the source; a build must not reload the pages being served.
      watch: { ignored: ['**/dist-g2/**'] },
      proxy: {
        // API_PROXY_TARGET lets a second dev server run beside another checkout's (another agent's on 8080).
        '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true },
      },
    },
    build: {
      target: 'es2022',
      // scripts/check-size.mjs reads the manifest to find the entry's static imports (D337).
      manifest: true,
      ...(g2Size ? { outDir: 'dist-g2', rollupOptions: { input: { g2: fileURLToPath(new URL('./g2.html', import.meta.url)) } } } : {}),
    },
  }
})
