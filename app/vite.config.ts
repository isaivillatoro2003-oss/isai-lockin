import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { host: true, port: 5180 },
  plugins: [
    react(),
    tailwindcss(),
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
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,json}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
})
