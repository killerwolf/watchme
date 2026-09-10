import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist-frontend',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  plugins: [
    {
      name: 'copy-watchme-assets',
      closeBundle() {
        const output = path.join('dist-frontend', 'misc');
        mkdirSync(output, { recursive: true });
        for (const asset of ['notification-sound.wav', 'tray-icon.png']) {
          cpSync(path.join('misc', asset), path.join(output, asset));
        }
      },
    },
  ],
});
