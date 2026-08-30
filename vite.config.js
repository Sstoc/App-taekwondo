import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpeg', 'icon-192.png', 'icon-512.png', 'icon-padded.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Taekwondo Chang Moo Kwan',
        short_name: 'Taekwondo CMK',
        description: 'Sistema oficial de gestión y portal de alumnos Taekwondo Chang Moo Kwan',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-padded.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/logo.jpeg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' }
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ihxvrsdyxhslwahkklmh\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    cssTarget: 'chrome90'
  }
})
