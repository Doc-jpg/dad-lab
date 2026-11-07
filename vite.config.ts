import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Dad Lab is a static, offline-first PWA and its own app next to Athletic Lab, Dugout Dad and Dugout Lab:
// its own manifest id, start URL and service-worker scope (the BASE_PATH), its own icon, and its own
// IndexedDB database name ("dad-lab"). Nothing here touches the other apps.
const base = process.env.BASE_PATH || '/';
const appName = process.env.APP_NAME || 'Dad Lab';
const themeColor = '#243b5e';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: appName,
        short_name: 'Dad Lab',
        id: base,
        description: 'Something every day: bands, the Happy Body, a stretch or the floor, picked by a daily check-in. Offline-first.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: themeColor,
        theme_color: themeColor,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  define: { __APP_NAME__: JSON.stringify(appName) },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] }
} as any);
