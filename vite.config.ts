import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from any folder or sub-path.
  base: './',
  server: { open: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
