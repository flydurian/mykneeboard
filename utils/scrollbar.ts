// Auto-hide scrollbar utility
// 스크롤 중일 때만 스크롤바를 표시하는 유틸리티

let scrollTimeout: NodeJS.Timeout | null = null;

export const initAutoHideScrollbar = (element: HTMLElement) => {
    if (!element) return;

    const handleScroll = () => {
        // 스크롤 중임을 표시
        element.classList.add('scrolling');

        // 이전 타이머 제거
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }

        // 스크롤이 멈춘 후 1초 뒤에 스크롤바 숨김
        scrollTimeout = setTimeout(() => {
            element.classList.remove('scrolling');
        }, 1000);
    };

    // 스크롤 이벤트 리스너 추가
    element.addEventListener('scroll', handleScroll, { passive: true });

    // 클린업 함수 반환
    return () => {
        element.removeEventListener('scroll', handleScroll);
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
    };
};

// React Hook으로 사용하기 위한 함수
export const useAutoHideScrollbar = (ref: React.RefObject<HTMLElement>) => {
    React.useEffect(() => {
        if (!ref.current) return;

        const cleanup = initAutoHideScrollbar(ref.current);
        return cleanup;
    }, [ref]);
};
