import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Solar-Monitor-3/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'earth.jpg'],
      manifest: {
        name: 'Солнечный монитор',
        short_name: 'Солнце',
        description: 'Космическая погода в реальном времени: магнитные бури, солнечный ветер, вспышки и сияния',
        lang: 'ru',
        theme_color: '#050a1c',
        background_color: '#050a1c',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Оболочку сайта кэшируем, данные NOAA — нет: они должны быть свежими,
        // а последний срез приложение само держит в localStorage.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
