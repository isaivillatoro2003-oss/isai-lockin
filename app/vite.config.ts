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
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ["GEMINI_API_KEY", "GEMINI_MODEL"]) if (env[k]) process.env[k] = env[k]
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
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
          maximumFileSizeToCacheInBytes: 8_000_000,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [{ urlPattern: /\/ex\/.*\.jpg$/, handler: 'CacheFirst', options: { cacheName: 'ejercicios' } }],
        },
      }),
    ],
  }
})
