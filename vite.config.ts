import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Tauri reads the built assets from dist/ and serves dev from this port.
export default defineConfig({
  base: './',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@sdk': fileURLToPath(new URL('./src/sdk/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
