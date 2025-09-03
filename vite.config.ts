import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/flight-dashboard-v2/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
