// 입력 검증 및 XSS 방지 유틸리티 함수들

// HTML 태그 제거 및 XSS 방지
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // HTML 태그 제거
    .replace(/javascript:/gi, '') // JavaScript URL 제거
    .replace(/on\w+=/gi, '') // 이벤트 핸들러 제거
    .trim()
    .substring(0, 1000); // 최대 길이 제한
};

// 이메일 검증
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// 비밀번호 검증
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('비밀번호는 6자 이상이어야 합니다.');
  }
  
  if (password.length > 128) {
    errors.push('비밀번호는 128자 이하여야 합니다.');
  }
  
  // 특수문자나 공백이 포함된 경우 경고 (선택사항)
  if (/[<>'"]/.test(password)) {
    errors.push('비밀번호에 특수문자 < > \' " 는 사용할 수 없습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 사용자 이름 검증
export const validateDisplayName = (name: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < 2) {
    errors.push('사용자 이름은 2자 이상이어야 합니다.');
  }
  
  if (sanitized.length > 50) {
    errors.push('사용자 이름은 50자 이하여야 합니다.');
  }
  
  if (sanitized !== name) {
    errors.push('사용자 이름에 허용되지 않는 문자가 포함되어 있습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 날짜 검증 (YYYY-MM-DD 형식)
export const validateDate = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 과거 날짜는 허용하지 않음
  return date >= today;
};

// 항공사 코드 검증
export const validateAirlineCode = (code: string): boolean => {
  const validCodes = ['OZ', 'KE', '7C', 'TW', 'BX', 'LJ', 'ZE', 'RS', '4V', 'SL', 'JX', 'NH', 'JL', 'MM'];
  return validCodes.includes(code.toUpperCase());
};

// 항공편 번호 검증
export const validateFlightNumber = (flightNumber: string): boolean => {
  const flightRegex = /^[A-Z0-9]{1,4}[0-9]{1,4}$/;
  return flightRegex.test(flightNumber.toUpperCase()) && flightNumber.length <= 8;
};

// 공항 코드 검증 (IATA 3자리)
export const validateAirportCode = (code: string): boolean => {
  const airportRegex = /^[A-Z]{3}$/;
  return airportRegex.test(code.toUpperCase());
};

// 숫자 검증
export const validateNumber = (value: string, min?: number, max?: number): boolean => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  
  return true;
};

// SQL 인젝션 방지 (문자열 검증)
export const validateString = (input: string, maxLength: number = 255): boolean => {
  if (typeof input !== 'string') return false;
  
  // SQL 인젝션 패턴 검사
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) return false;
  }
  
  return input.length <= maxLength;
};
