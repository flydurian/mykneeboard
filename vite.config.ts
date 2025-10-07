import * as path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    // Performance optimizations
    rollupOptions: {
      output: {
        // 명시적으로 파일 해싱 활성화 (Vercel 캐시 최적화)
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/database'],
          'utils-vendor': ['date-fns', 'date-fns-tz', 'xlsx'],
        },
      },
    },
    // Enable source maps for debugging
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // 빌드 결과물 최적화 (esbuild 사용)
    minify: 'esbuild',
  },
  // Development server optimizations
  server: {
    // Enable HMR for instant code updates
    hmr: {
      port: 24678,
      host: 'localhost',
      // Use different protocol to avoid CSP issues
      protocol: 'ws',
    },
    // Ensure proper host binding
    host: 'localhost',
    port: 5173, // Change to default Vite port
    // Use single port only
    strictPort: true,
    // Add CORS headers to allow WebSocket connections
    cors: true,
    // Add headers for PDF.js Worker support
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh https://www.googletagmanager.com https://cdnjs.cloudflare.com http://cdnjs.cloudflare.com https://*.firebasedatabase.app; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https://*.googleusercontent.com https://*.google-analytics.com https://*.googletagmanager.com https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://*.firebasedatabase.app https://api.openweathermap.org https://api.sunrise-sunset.org https://api.checkwx.com https://www.google-analytics.com https://www.google.com https://www.googleapis.com https://www.googletagmanager.com http://cdnjs.cloudflare.com https://cdn.tailwindcss.com wss://*.firebasedatabase.app ws://localhost:*; frame-src 'self' https://*.firebaseapp.com https://*.firebasedatabase.app;"
    }
  },
  // CSS optimizations
  css: {
    devSourcemap: true,
  },
  // Asset handling
  assetsInclude: ['**/*.webp', '**/*.avif'],
  // Enable WebSocket for HMR with CSP bypass
  define: {
    __VITE_HMR_DISABLE__: false,
  },
  // esbuild 설정 (프로덕션에서 console.log 제거)
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
