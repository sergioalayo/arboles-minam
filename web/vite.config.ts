import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `data/arboles.json` vive fuera de `web/` (salida de la Fase 1) y se empaqueta como módulo estático.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('elkjs')) return 'elk';
          if (id.includes('@xyflow')) return 'xyflow';
          return undefined;
        },
      },
    },
  },
});
