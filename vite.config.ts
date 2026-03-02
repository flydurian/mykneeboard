import * as path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  optimizeDeps: {
    include: ['recharts']
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
          // 핵심 React
          'react-vendor': ['react', 'react-dom'],
          // Firebase (필수, 항상 로드)
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/database'],
          // 애니메이션 (별도 분리)
          'motion-vendor': ['framer-motion'],
          // 차트 (별도 분리)
          'chart-vendor': ['recharts'],
          // 날짜 유틸
          'date-vendor': ['date-fns', 'date-fns-tz'],
          // exceljs, pdfjs-dist는 manualChunks에서 제외 → 사용 시 dynamic import로 로드
        },
      },
    },
    // 프로덕션에서 sourcemap 비활성화 (배포 크기 대폭 절감)
    sourcemap: false,
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
    port: Number(process.env.PORT) || 5173,
    // Use single port only
    strictPort: true,
    // Add CORS headers to allow WebSocket connections
    cors: true,
    // Add headers for PDF.js Worker support
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh https://www.googletagmanager.com https://www.gstatic.com https://cdnjs.cloudflare.com http://cdnjs.cloudflare.com https://*.firebasedatabase.app https://*.firebaseio.com; worker-src 'self' blob: https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https://*.googleusercontent.com https://*.google-analytics.com https://*.googletagmanager.com https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://kauth.kakao.com https://kapi.kakao.com https://*.firebaseapp.com https://*.googleapis.com https://*.firebasedatabase.app https://*.firebaseio.com https://api.openweathermap.org https://api.sunrise-sunset.org https://api.checkwx.com https://www.google-analytics.com https://www.google.com https://www.googleapis.com https://www.googletagmanager.com http://cdnjs.cloudflare.com https://cdn.tailwindcss.com wss://*.firebasedatabase.app wss://*.firebaseio.com ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*; frame-src 'self' https://*.firebaseapp.com https://*.firebasedatabase.app;"
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
    'import.meta.env.VITE_APP_DISPLAY_VERSION': JSON.stringify(pkg.version),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // 프로덕션 빌드에서 console.log, debugger 제거
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});

