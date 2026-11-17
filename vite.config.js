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
          if (id.includes('node_modules/three') || id.includes('node_modules\\three')) {
            return 'three-vendor';
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
