import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** En desarrollo sirve /api/ai con el mismo código que la función de Vercel. */
function aiDevApi(): Plugin {
  return {
    name: 'ai-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { error: 'Solo POST' })
        let raw = ''
        for await (const chunk of req) raw += chunk
        const { runAi, errorMessage } = await server.ssrLoadModule('/api/_core.ts')
        try { send(200, await runAi(JSON.parse(raw))) } catch (e) { send(500, { error: errorMessage(e) }) }
      })
      server.middlewares.use('/api/sync', async (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        const { runSync, checkKey, statusOf, messageOf } = await server.ssrLoadModule('/api/_sync.ts')
        try {
          checkKey(req.headers['x-sync-key'] as string | undefined)
          send(200, await runSync(JSON.parse(raw)))
        } catch (e) { send(statusOf(e), { error: messageOf(e) }) }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ["GEMINI_API_KEY", "GEMINI_MODEL", "NVIDIA_API_KEY", "NVIDIA_MODEL", "SYNC_KEY", "BLOB_READ_WRITE_TOKEN"]) if (env[k]) process.env[k] = env[k]
  return {
    server: { host: true, port: 5180 },
    plugins: [
      react(),
      tailwindcss(),
      aiDevApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Lock-in',
          short_name: 'Lock-in',
          description: 'Rutina, cuerpo e idiomas de Isaí',
          theme_color: '#0d0c0a',
          background_color: '#0d0c0a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,jpg}'],
          maximumFileSizeToCacheInBytes: 8_000_000,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/audio\//],
          /* Las voces (miles de MP3) no van en el precache: se guardan al oírlas por primera vez. */
          runtimeCaching: [{
            urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'voces-v2', expiration: { maxEntries: 8000 }, cacheableResponse: { statuses: [200] }, rangeRequests: true },
          }],
        },
      }),
    ],
  }
})
