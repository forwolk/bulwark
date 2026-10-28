import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
