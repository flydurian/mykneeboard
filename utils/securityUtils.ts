// 보안 유틸리티 함수들

// Rate Limiting 구현
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // 오래된 요청 제거
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 새 요청 추가
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

export const rateLimiter = new RateLimiter();

// CSRF 토큰 생성
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// CSRF 토큰 검증
export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  return token === storedToken && token.length === 64;
};

// XSS 방지 함수
export const sanitizeHTML = (input: string): string => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

// SQL 인젝션 방지 (클라이언트 사이드)
export const sanitizeSQL = (input: string): string => {
  return input
    .replace(/['"\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/sp_/gi, '');
};

// 파일 업로드 보안 검증
export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  // 파일 크기 제한 (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: '파일 크기가 너무 큽니다. (최대 10MB)' };
  }

  // 허용된 파일 타입
  const allowedTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: '허용되지 않는 파일 형식입니다.' };
  }

  // 파일명 검증
  const fileName = file.name;
  if (fileName.length > 255) {
    return { isValid: false, error: '파일명이 너무 깁니다.' };
  }

  // 위험한 파일명 패턴 검사
  const dangerousPatterns = [
    /\.\./,  // 경로 탐색
    /[<>:"|?*]/,  // 특수문자
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows 예약어
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(fileName)) {
      return { isValid: false, error: '안전하지 않은 파일명입니다.' };
    }
  }

  return { isValid: true };
};

// 클라이언트 IP 추출 (프록시 환경 고려)
export const getClientIP = (request: any): string => {
  return (
    request.headers['x-forwarded-for']?.split(',')[0] ||
    request.headers['x-real-ip'] ||
    request.connection?.remoteAddress ||
    request.socket?.remoteAddress ||
    'unknown'
  );
};

// 보안 헤더 설정
export const setSecurityHeaders = (response: any) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
};

// 환경변수 검증
export const validateEnvironmentVariables = (): { isValid: boolean; missing: string[] } => {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID'
  ];

  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!import.meta.env[varName]) {
      missing.push(varName);
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
};

// 데이터 암호화 (간단한 Base64 인코딩)
export const encryptData = (data: string): string => {
  return btoa(encodeURIComponent(data));
};

// 데이터 복호화
export const decryptData = (encryptedData: string): string => {
  try {
    return decodeURIComponent(atob(encryptedData));
  } catch (error) {
    throw new Error('데이터 복호화 실패');
  }
};

// 세션 타임아웃 관리
export const createSessionTimeout = (timeoutMs: number = 30 * 60 * 1000) => {
  let timeoutId: NodeJS.Timeout;
  
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // 세션 만료 시 로그아웃
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }, timeoutMs);
  };

  const clearSessionTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { resetTimeout, clearTimeout: clearSessionTimeout };
};
