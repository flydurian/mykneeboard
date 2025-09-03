import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mykneeboard/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
