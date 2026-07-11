import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const externalEnvPath = resolve(homedir(), 'secrets', 'schedule-assistant.env');
const base = (process.env.GITHUB_PAGES ?? '') === 'true' ? '/ScheduleAssistant/' : '/';

if (existsSync(externalEnvPath)) {
  dotenv.config({ path: externalEnvPath });
}

function getViteEnvDefines(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([key, value]) => key.startsWith('VITE_') && value !== undefined)
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );
}

export default defineConfig({
  define: getViteEnvDefines(),
  plugins: [
    react(),
    VitePWA({
      mode: 'development',
      minify: false,
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/favicon-32.png',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],
      scope: base,
      manifest: {
        name: 'Schedule Assistant',
        short_name: 'Schedule',
        description: '毎朝のデイリータスク割り振り補助',
        theme_color: '#0891b2',
        background_color: '#e8eef5',
        display: 'standalone',
        start_url: base,
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base,
});
