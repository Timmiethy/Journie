import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/react/') ||
            id.includes('\\react\\') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'framework';
          }

          if (id.includes('framer-motion')) {
            return 'motion';
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('mdast-') ||
            id.includes('micromark')
          ) {
            return 'markdown';
          }

          if (
            id.includes('date-fns') ||
            id.includes('lucide-react') ||
            id.includes('sonner') ||
            id.includes('zustand')
          ) {
            return 'ui-vendor';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: true,
    port: 5173,
    watch: {
      ignored: ['**/test-results/**', '**/playwright-report/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
