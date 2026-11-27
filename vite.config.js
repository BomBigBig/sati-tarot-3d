import { defineConfig } from 'vite';
import { createSatiExpressApp } from './backend/geminiProxyServer.js';

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('node_modules/three')) {
            return 'three-vendor';
          }
          if (norm.includes('/src/i18n/')) {
            return 'sati-i18n';
          }
        }
      }
    }
  },
  plugins: [
    {
      name: 'sati-backend-middleware',
      configureServer(server) {
        const apiApp = createSatiExpressApp();
        server.middlewares.use(apiApp);
      },
      configurePreviewServer(server) {
        const apiApp = createSatiExpressApp();
        server.middlewares.use(apiApp);
      }
    }
  ]
});
