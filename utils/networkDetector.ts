export interface NetworkStatus {
  isOnline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
  connectionType?: 'wifi' | 'cellular' | 'none';
}

class NetworkDetector {
  private status: NetworkStatus = {
    isOnline: navigator.onLine,
    lastOnline: null,
    lastOffline: null
  };

  private listeners: ((status: NetworkStatus) => void)[] = [];

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 기본 온라인/오프라인 이벤트
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));

    // 네트워크 정보 API (지원하는 브라우저에서만)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        this.updateConnectionType(connection.effectiveType);
      });
    }

    this.updateStatus(navigator.onLine);
  }

  private updateStatus(isOnline: boolean) {
    const now = new Date();
    
    if (isOnline && !this.status.isOnline) {
      this.status.lastOnline = now;
    } else if (!isOnline && this.status.isOnline) {
      this.status.lastOffline = now;
    }

    this.status.isOnline = isOnline;
    this.notifyListeners();
  }

  private updateConnectionType(type: string) {
    this.status.connectionType = type === 'wifi' ? 'wifi' : 
                                type === 'cellular' ? 'cellular' : 'none';
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.status }));
  }

  // 상태 변경 리스너 등록
  subscribe(listener: (status: NetworkStatus) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // 현재 상태 가져오기
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  // 연결 테스트
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const networkDetector = new NetworkDetector();
