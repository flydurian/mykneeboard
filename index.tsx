
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA(홈 화면 추가로 실행) 시 초기 스크롤을 맨 위로 고정
(() => {
  const isStandalone = ((): boolean => {
    try {
      return (
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        // iOS Safari 전용
        (navigator as any).standalone === true
      );
    } catch {
      return false;
    }
  })();

  if (isStandalone) {
    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    } catch {}

    const scrollTop = () => {
      try {
        window.scrollTo({ top: 0, left: 0 });
      } catch {
        window.scrollTo(0, 0);
      }

      // 내부 스크롤 컨테이너도 초기화 (주요 후보들)
      try {
        const root = document.getElementById('root');
        if (root) {
          (root as HTMLElement).scrollTop = 0;
        }
        // React 루트 래퍼들 또는 overflow-auto 적용된 요소들
        document.querySelectorAll('.overflow-auto, .overflow-y-auto, [data-scroll-root]').forEach((el) => {
          const anyEl = el as HTMLElement & { scrollTop?: number };
          if (typeof anyEl.scrollTop === 'number') {
            anyEl.scrollTop = 0;
          }
        });
      } catch {}
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(scrollTop, 0);
    } else {
      window.addEventListener('DOMContentLoaded', scrollTop, { once: true });
    }

    // bfcache 복귀 또는 최초 표시 시 보정
    window.addEventListener('pageshow', () => scrollTop(), { once: true });
    // 레이아웃이 늦게 만들어지는 경우를 위한 추가 보정
    window.addEventListener('load', () => {
      scrollTop();
      setTimeout(scrollTop, 50);
      setTimeout(scrollTop, 150);
    }, { once: true });
  }
})();
