// 고성능 암호화/복호화 유틸리티
// Web Crypto API를 사용한 AES-GCM 암호화

// 키 캐싱을 위한 Map
const keyCache = new Map<string, CryptoKey>();

// 사용자 ID 기반 암호화 키 생성 (PBKDF2 사용, 캐싱 포함)
const generateCryptoKey = async (userId: string): Promise<CryptoKey> => {
  // 캐시에서 키 확인
  if (keyCache.has(userId)) {
    return keyCache.get(userId)!;
  }
  
  // 사용자별 고정 패스워드 생성 (보안을 위해 복잡한 문자열 사용)
  const password = `${userId}_flightdashboard2024_secure_key_generation`;
  
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // PBKDF2로 키 유도
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // 솔트 생성 (사용자별 고정 솔트)
  const salt = await crypto.subtle.digest('SHA-256', encoder.encode('flightdashboard_salt_' + userId));
  
  // AES-GCM 키 유도
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // 높은 보안을 위한 반복 횟수
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  // 키를 캐시에 저장
  keyCache.set(userId, key);
  
  return key;
};

// 데이터 압축 함수
const compressData = async (data: string): Promise<string> => {
  try {
    // CompressionStream 지원 확인
    if (typeof CompressionStream === 'undefined') {
      console.warn('CompressionStream이 지원되지 않습니다. 압축 없이 진행합니다.');
      return data;
    }
    
    // CompressionStream을 사용한 압축
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    // 데이터를 Uint8Array로 변환
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // 압축 시작
    writer.write(dataBuffer);
    writer.close();
    
    // 압축된 데이터 읽기
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // 압축된 데이터를 하나의 Uint8Array로 합치기
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const compressedData = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      compressedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Base64로 인코딩
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < compressedData.length; i += chunkSize) {
      const chunk = compressedData.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    
    // 압축된 데이터임을 표시하는 마커 추가
    return 'COMPRESSED:' + btoa(binaryString);
  } catch (error) {
    console.error('압축 오류:', error);
    return data; // 압축 실패 시 원본 데이터 반환
  }
};

// 데이터가 압축된 데이터인지 확인하는 함수
const isCompressedData = (data: string): boolean => {
  return data.startsWith('COMPRESSED:');
};

// 데이터 압축 해제 함수
const decompressData = async (compressedData: string): Promise<string> => {
  try {
    // DecompressionStream 지원 확인
    if (typeof DecompressionStream === 'undefined') {
      console.warn('DecompressionStream이 지원되지 않습니다. 압축 해제 없이 진행합니다.');
      return compressedData;
    }
    
    // 압축된 데이터인지 확인
    if (!isCompressedData(compressedData)) {
      return compressedData;
    }
    
    // 마커 제거
    const base64Data = compressedData.substring('COMPRESSED:'.length);
    
    // Base64 디코딩
    const binaryString = atob(base64Data);
    const compressedBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedBuffer[i] = binaryString.charCodeAt(i);
    }
    
    // DecompressionStream을 사용한 압축 해제
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    // 압축 해제 시작
    writer.write(compressedBuffer);
    writer.close();
    
    // 압축 해제된 데이터 읽기
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // 압축 해제된 데이터를 하나의 Uint8Array로 합치기
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const decompressedData = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      decompressedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    // UTF-8로 디코딩
    const decoder = new TextDecoder();
    return decoder.decode(decompressedData);
  } catch (error) {
    console.error('압축 해제 오류:', error);
    return compressedData; // 압축 해제 실패 시 원본 데이터 반환
  }
};

// AES-GCM 암호화 (압축 비활성화 - 호환성 개선)
export const encryptData = async (data: string, userId: string): Promise<string> => {
  try {
    
    const key = await generateCryptoKey(userId);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // 랜덤 IV 생성 (12바이트)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // AES-GCM 암호화
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );
    
    // IV + 암호화된 데이터를 Base64로 인코딩
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // 큰 배열을 처리하기 위해 청크 단위로 변환
    let binaryString = '';
    const chunkSize = 8192; // 8KB 청크
    for (let i = 0; i < combined.length; i += chunkSize) {
      const chunk = combined.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    
    return btoa(binaryString);
  } catch (error) {
    console.error('암호화 오류:', error);
    return data; // 암호화 실패 시 원본 데이터 반환
  }
};

// AES-GCM 복호화
export const decryptData = async (encryptedData: string, userId: string): Promise<string> => {
  try {
    // 입력 데이터 유효성 검사
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('유효하지 않은 암호화된 데이터');
    }
    
    const key = await generateCryptoKey(userId);
    
    // Base64 디코딩
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // 최소 길이 확인 (IV 12바이트 + 암호화된 데이터)
    if (combined.length < 13) {
      throw new Error('암호화된 데이터가 너무 짧습니다');
    }
    
    // IV 추출 (처음 12바이트)
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);
    
    // AES-GCM 복호화
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedBuffer
    );
    
    const decoder = new TextDecoder();
    const result = decoder.decode(decryptedBuffer);
    
    return result;
  } catch (error) {
    // OperationError나 다른 암호화 오류를 상위로 전달
    throw error;
  }
};

// 문서 만료일 데이터 암호화
export const encryptDocumentExpiryDates = async (expiryDates: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const encrypted: {[key: string]: string} = {};
  
  for (const [documentType, date] of Object.entries(expiryDates)) {
    if (date) {
      encrypted[documentType] = await encryptData(date, userId);
    }
  }
  
  return encrypted;
};

// 문서 만료일 데이터 복호화 (AES-GCM 우선, 기존 데이터 호환성 포함)
export const decryptDocumentExpiryDates = async (encryptedExpiryDates: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const decrypted: {[key: string]: string} = {};
  
  for (const [documentType, encryptedDate] of Object.entries(encryptedExpiryDates)) {
    if (encryptedDate) {
      try {
        // 먼저 새로운 AES-GCM 방식으로 복호화 시도
        const aesResult = await decryptData(encryptedDate, userId);
        if (isValidDateFormat(aesResult)) {
          decrypted[documentType] = aesResult;
          continue;
        }
      } catch (aesError) {
      }
      
      // AES-GCM 실패 시 기존 방식으로 복호화 시도 (호환성)
      try {
        const legacyResult = decryptDataLegacy(encryptedDate);
        if (isValidDateFormat(legacyResult)) {
          decrypted[documentType] = legacyResult;
        } else {
          // 유효하지 않은 날짜 형식이면 빈 문자열로 설정
          decrypted[documentType] = '';
          console.warn(`문서 ${documentType}: 유효하지 않은 날짜 형식`);
        }
      } catch (legacyError) {
        console.error(`문서 ${documentType} 레거시 복호화 오류:`, legacyError);
        // 모든 복호화 시도 실패 시 기존 암호화된 데이터를 그대로 유지 (데이터 손실 방지)
        decrypted[documentType] = encryptedDate;
        console.warn(`문서 ${documentType}: 모든 복호화 실패로 원본 데이터 유지`);
      }
    }
  }
  
  return decrypted;
};

// 기존 방식 복호화 (호환성용) - 여러 키 시도
const decryptDataLegacy = (encryptedData: string): string => {
  try {
    // 여러 가능한 키로 복호화 시도
    const possibleKeys = [
      // 기본 키들 (앱과 무관한 단어들)
      'quantummechanics2024',
      'astrophysics',
      'neuroscience123',
      // 빈 키
      ''
    ];
    
    for (const keyBase of possibleKeys) {
      try {
        const key = btoa(keyBase).slice(0, 16);
        const decoded = decodeURIComponent(escape(atob(encryptedData)));
        const dataWithKey = decoded;
        const data = dataWithKey.slice(0, -key.length);
        const result = decodeURIComponent(escape(atob(data)));
        
        // 유효한 날짜 형식인지 확인
        if (isValidDateFormat(result)) {
          return result;
        }
      } catch (e) {
        // 이 키로는 복호화 실패, 다음 키 시도
        continue;
      }
    }
    
    // 모든 키로 실패한 경우 원본 반환
    return encryptedData;
  } catch (error) {
    console.error('기존 방식 복호화 오류:', error);
    return encryptedData;
  }
};

// 날짜 형식 검증
const isValidDateFormat = (dateString: string): boolean => {
  if (!dateString) return false;
  // YYYY-MM-DD 형식인지 확인
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
};

// 키 캐시 정리 함수 (로그아웃 시 호출)
export const clearKeyCache = (userId?: string) => {
  if (userId) {
    keyCache.delete(userId);
  } else {
    keyCache.clear();
  }
};

// 키 캐시 상태 확인 (디버깅용)
export const getKeyCacheStatus = () => {
  return {
    size: keyCache.size,
    keys: Array.from(keyCache.keys())
  };
};

// 기존 데이터를 새로운 암호화 방식으로 업그레이드
export const upgradeDocumentExpiryDates = async (encryptedExpiryDates: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const upgraded: {[key: string]: string} = {};
  
  for (const [documentType, encryptedDate] of Object.entries(encryptedExpiryDates)) {
    if (encryptedDate) {
      try {
        let decryptedDate = '';
        
        // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
        try {
          decryptedDate = await decryptData(encryptedDate, userId);
          if (isValidDateFormat(decryptedDate)) {
            // 이미 AES-GCM으로 암호화된 경우 그대로 유지
            upgraded[documentType] = encryptedDate;
            continue;
          }
        } catch (aesError) {
          // AES-GCM 복호화 실패 시 기존 방식으로 시도
        }
        
        // 기존 방식으로 복호화 시도
        decryptedDate = decryptDataLegacy(encryptedDate);
        
        if (isValidDateFormat(decryptedDate)) {
          // 유효한 날짜라면 새로운 방식으로 암호화
          const newEncryptedDate = await encryptData(decryptedDate, userId);
          upgraded[documentType] = newEncryptedDate;
        } else {
          // 유효하지 않은 날짜라면 빈 문자열로 설정
          upgraded[documentType] = '';
          console.warn(`문서 ${documentType}: 유효하지 않은 날짜 형식, 빈 문자열로 설정`);
        }
      } catch (error) {
        console.error(`문서 ${documentType} 업그레이드 오류:`, error);
        // 업그레이드 실패 시 빈 문자열로 설정
        upgraded[documentType] = '';
      }
    }
  }
  
  return upgraded;
};

// Crew 메모 암호화/복호화 함수들
export const encryptCrewMemos = async (memos: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const encryptedMemos: {[key: string]: string} = {};
  
  for (const [crewName, memo] of Object.entries(memos)) {
    if (memo && memo.trim()) {
      try {
        encryptedMemos[crewName] = await encryptData(memo, userId);
      } catch (error) {
        console.error(`Crew ${crewName} 메모 암호화 오류:`, error);
        // 암호화 실패 시 원본 유지
        encryptedMemos[crewName] = memo;
      }
    }
  }
  
  return encryptedMemos;
};

export const decryptCrewMemos = async (encryptedMemos: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const decryptedMemos: {[key: string]: string} = {};
  
  for (const [crewName, encryptedMemo] of Object.entries(encryptedMemos)) {
    if (encryptedMemo && encryptedMemo.trim()) {
      try {
        // 먼저 새로운 AES-GCM 방식으로 복호화 시도
        const aesDecrypted = await decryptData(encryptedMemo, userId);
        if (aesDecrypted && aesDecrypted.trim()) {
          decryptedMemos[crewName] = aesDecrypted;
          continue;
        }
      } catch (aesError) {
      }
      
      // AES-GCM 실패 시 기존 방식으로 복호화 시도 (호환성)
      try {
        const legacyDecrypted = decryptDataLegacy(encryptedMemo);
        if (legacyDecrypted && legacyDecrypted.trim()) {
          decryptedMemos[crewName] = legacyDecrypted;
        } else {
          // 모든 복호화 시도 실패 시 빈 문자열로 처리
          decryptedMemos[crewName] = '';
          console.warn(`Crew ${crewName} 메모: 유효하지 않은 메모 내용`);
        }
      } catch (legacyError) {
        console.error(`Crew ${crewName} 메모 레거시 복호화 오류:`, legacyError);
        // 모든 복호화 시도 실패 시 기존 암호화된 데이터를 그대로 유지 (데이터 손실 방지)
        decryptedMemos[crewName] = encryptedMemo;
        console.warn(`Crew ${crewName} 메모: 모든 복호화 실패로 원본 데이터 유지`);
      }
    }
  }
  
  return decryptedMemos;
};

export const upgradeCrewMemos = async (encryptedMemos: {[key: string]: string}, userId: string): Promise<{[key: string]: string}> => {
  const upgraded: {[key: string]: string} = {};
  
  for (const [crewName, encryptedMemo] of Object.entries(encryptedMemos)) {
    if (encryptedMemo && encryptedMemo.trim()) {
      try {
        let decryptedMemo = '';
        
        // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
        try {
          decryptedMemo = await decryptData(encryptedMemo, userId);
          if (decryptedMemo && decryptedMemo.trim()) {
            // 이미 AES-GCM으로 암호화된 경우 그대로 유지
            upgraded[crewName] = encryptedMemo;
            continue;
          }
        } catch (aesError) {
          // AES-GCM 복호화 실패 시 기존 방식으로 시도
        }
        
        // 기존 방식으로 복호화 시도
        decryptedMemo = decryptDataLegacy(encryptedMemo);
        if (decryptedMemo && decryptedMemo.trim()) {
          // 레거시 복호화 성공 시 새로운 방식으로 재암호화
          upgraded[crewName] = await encryptData(decryptedMemo, userId);
        } else {
          // 복호화 실패 시 빈 문자열로 설정
          upgraded[crewName] = '';
          console.warn(`Crew ${crewName} 메모: 복호화 실패, 빈 문자열로 설정`);
        }
      } catch (error) {
        console.error(`Crew ${crewName} 메모 업그레이드 오류:`, error);
        // 업그레이드 실패 시 빈 문자열로 설정
        upgraded[crewName] = '';
      }
    }
  }
  
  return upgraded;
};

// 도시 메모 암호화
export const encryptCityMemos = async (cityMemos: Record<string, string>, userId: string): Promise<Record<string, string>> => {
  const encrypted: Record<string, string> = {};
  
  for (const [cityCode, memo] of Object.entries(cityMemos)) {
    if (memo && memo.trim()) {
      try {
        encrypted[cityCode] = await encryptData(memo, userId);
      } catch (error) {
        console.error(`도시 ${cityCode} 메모 암호화 오류:`, error);
        // 암호화 실패 시 원본 유지
        encrypted[cityCode] = memo;
      }
    }
  }
  
  return encrypted;
};

// 도시 메모 복호화
export const decryptCityMemos = async (encryptedCityMemos: Record<string, string>, userId: string): Promise<Record<string, string>> => {
  const decrypted: Record<string, string> = {};
  
  for (const [cityCode, encryptedMemo] of Object.entries(encryptedCityMemos)) {
    if (encryptedMemo && encryptedMemo.trim()) {
      try {
        // 먼저 새로운 AES-GCM 방식으로 복호화 시도
        const aesDecrypted = await decryptData(encryptedMemo, userId);
        if (aesDecrypted && aesDecrypted.trim()) {
          decrypted[cityCode] = aesDecrypted;
          continue;
        }
      } catch (aesError) {
      }
      
      // AES-GCM 실패 시 기존 방식으로 복호화 시도 (호환성)
      try {
        const legacyDecrypted = decryptDataLegacy(encryptedMemo);
        if (legacyDecrypted && legacyDecrypted.trim()) {
          decrypted[cityCode] = legacyDecrypted;
        } else {
          // 모든 복호화 시도 실패 시 빈 문자열로 처리
          decrypted[cityCode] = '';
          console.warn(`도시 ${cityCode} 메모: 유효하지 않은 메모 내용`);
        }
      } catch (legacyError) {
        console.error(`도시 ${cityCode} 메모 레거시 복호화 오류:`, legacyError);
        // 모든 복호화 시도 실패 시 기존 암호화된 데이터를 그대로 유지 (데이터 손실 방지)
        decrypted[cityCode] = encryptedMemo;
        console.warn(`도시 ${cityCode} 메모: 모든 복호화 실패로 원본 데이터 유지`);
      }
    }
  }
  
  return decrypted;
};

// 도시 메모 업그레이드 (레거시에서 AES-GCM으로)
export const upgradeCityMemos = async (encryptedCityMemos: Record<string, string>, userId: string): Promise<Record<string, string>> => {
  const upgraded: Record<string, string> = {};
  
  for (const [cityCode, encryptedMemo] of Object.entries(encryptedCityMemos)) {
    if (encryptedMemo && encryptedMemo.trim()) {
      try {
        let decryptedMemo = '';
        
        // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
        try {
          decryptedMemo = await decryptData(encryptedMemo, userId);
          if (decryptedMemo && decryptedMemo.trim()) {
            // 이미 AES-GCM으로 암호화된 경우 그대로 유지
            upgraded[cityCode] = encryptedMemo;
            continue;
          }
        } catch (aesError) {
          // AES-GCM 복호화 실패 시 기존 방식으로 시도
        }
        
        // 기존 방식으로 복호화 시도
        decryptedMemo = decryptDataLegacy(encryptedMemo);
        if (decryptedMemo && decryptedMemo.trim()) {
          // 레거시 복호화 성공 시 새로운 방식으로 암호화
          upgraded[cityCode] = await encryptData(decryptedMemo, userId);
        } else {
          // 복호화 실패 시 빈 문자열로 설정
          upgraded[cityCode] = '';
          console.warn(`도시 ${cityCode} 메모: 복호화 실패, 빈 문자열로 설정`);
        }
      } catch (error) {
        console.error(`도시 ${cityCode} 메모 업그레이드 오류:`, error);
        // 업그레이드 실패 시 빈 문자열로 설정
        upgraded[cityCode] = '';
      }
    }
  }
  
  return upgraded;
};

// 사용자 설정 암호화
export const encryptUserSettings = async (settings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }, userId: string): Promise<{ airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }> => {
  const encryptedSettings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string } = {};
  
  // airline 암호화
  if (settings.airline) {
    try {
      encryptedSettings.airline = await encryptData(settings.airline, userId);
    } catch (error) {
      console.error('airline 암호화 오류:', error);
      encryptedSettings.airline = settings.airline; // 암호화 실패 시 원본 유지
    }
  }
  
  // empl 암호화
  if (settings.empl) {
    try {
      encryptedSettings.empl = await encryptData(settings.empl, userId);
    } catch (error) {
      console.error('empl 암호화 오류:', error);
      encryptedSettings.empl = settings.empl; // 암호화 실패 시 원본 유지
    }
  }
  
  // userName 암호화
  if (settings.userName) {
    try {
      encryptedSettings.userName = await encryptData(settings.userName, userId);
    } catch (error) {
      console.error('userName 암호화 오류:', error);
      encryptedSettings.userName = settings.userName; // 암호화 실패 시 원본 유지
    }
  }
  
  // selectedCurrencyCards는 배열이므로 암호화하지 않음 (민감하지 않은 데이터)
  if (settings.selectedCurrencyCards) {
    encryptedSettings.selectedCurrencyCards = settings.selectedCurrencyCards;
  }
  
  return encryptedSettings;
};

// 사용자 설정 복호화
export const decryptUserSettings = async (encryptedSettings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }, userId: string): Promise<{ airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }> => {
  const decryptedSettings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string } = {};
  
  // airline 복호화
  if (encryptedSettings.airline) {
    try {
      // 먼저 새로운 AES-GCM 방식으로 복호화 시도
      const aesDecrypted = await decryptData(encryptedSettings.airline, userId);
      if (aesDecrypted && aesDecrypted.trim()) {
        decryptedSettings.airline = aesDecrypted;
      } else {
        // AES-GCM 실패 시 기존 방식으로 복호화 시도 (호환성)
        const legacyDecrypted = decryptDataLegacy(encryptedSettings.airline);
        if (legacyDecrypted && legacyDecrypted.trim()) {
          decryptedSettings.airline = legacyDecrypted;
        } else {
          // 모든 복호화 시도 실패 시 기본값 사용
          console.warn('airline: 모든 복호화 실패로 기본값 사용');
          // 복호화 실패 시 기본값 사용 (암호화된 데이터는 사용하지 않음)
        }
      }
    } catch (error) {
      console.error('airline 복호화 오류:', error);
      // 복호화 실패 시 기본값 사용 (암호화된 데이터는 사용하지 않음)
      console.warn('airline: 복호화 오류로 기본값 사용');
    }
  }
  
  // empl 복호화
  if (encryptedSettings.empl) {
    try {
      // Legacy 방식으로 복호화 시도
      const legacyDecrypted = decryptDataLegacy(encryptedSettings.empl);
      if (legacyDecrypted && legacyDecrypted.trim()) {
        decryptedSettings.empl = legacyDecrypted;
      }
    } catch (error) {
      console.error('empl 복호화 오류:', error);
      console.warn('empl: 복호화 오류로 기본값 사용');
    }
  }
  
  // userName 복호화
  if (encryptedSettings.userName) {
    try {
      // Legacy 방식으로 복호화 시도
      const legacyDecrypted = decryptDataLegacy(encryptedSettings.userName);
      if (legacyDecrypted && legacyDecrypted.trim()) {
        decryptedSettings.userName = legacyDecrypted;
      }
    } catch (error) {
      console.error('userName 복호화 오류:', error);
      // 복호화 실패 시 기본값 사용 (암호화된 데이터는 사용하지 않음)
      console.warn('userName: 복호화 오류로 기본값 사용');
    }
  }
  
  // selectedCurrencyCards는 암호화되지 않으므로 그대로 복사
  if (encryptedSettings.selectedCurrencyCards) {
    decryptedSettings.selectedCurrencyCards = encryptedSettings.selectedCurrencyCards;
  }
  
  return decryptedSettings;
};

// 사용자 설정 업그레이드 (레거시에서 AES-GCM으로)
export const upgradeUserSettings = async (encryptedSettings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }, userId: string): Promise<{ airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string }> => {
  const upgraded: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string } = {};
  
  // airline 업그레이드
  if (encryptedSettings.airline) {
    try {
      let decryptedAirline = '';
      
      // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
      try {
        decryptedAirline = await decryptData(encryptedSettings.airline, userId);
        if (decryptedAirline && decryptedAirline.trim()) {
          // 이미 AES-GCM으로 암호화된 경우 그대로 유지
          upgraded.airline = encryptedSettings.airline;
        }
      } catch (aesError) {
        // AES-GCM 복호화 실패 시 기존 방식으로 시도
        decryptedAirline = decryptDataLegacy(encryptedSettings.airline);
        if (decryptedAirline && decryptedAirline.trim()) {
          // 레거시 복호화 성공 시 새로운 방식으로 암호화
          upgraded.airline = await encryptData(decryptedAirline, userId);
        } else {
          // 복호화 실패 시 빈 문자열로 설정
          upgraded.airline = '';
          console.warn('airline: 복호화 실패, 빈 문자열로 설정');
        }
      }
    } catch (error) {
      console.error('airline 업그레이드 오류:', error);
      // 업그레이드 실패 시 빈 문자열로 설정
      upgraded.airline = '';
    }
  }
  
  // empl 업그레이드
  if (encryptedSettings.empl) {
    try {
      let decryptedEmpl = '';
      
      // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
      try {
        decryptedEmpl = await decryptData(encryptedSettings.empl, userId);
        if (decryptedEmpl && decryptedEmpl.trim()) {
          // 이미 AES-GCM으로 암호화된 경우 그대로 유지
          upgraded.empl = encryptedSettings.empl;
        }
      } catch (aesError) {
        // AES-GCM 복호화 실패 시 기존 방식으로 시도
        decryptedEmpl = decryptDataLegacy(encryptedSettings.empl);
        if (decryptedEmpl && decryptedEmpl.trim()) {
          // 레거시 복호화 성공 시 새로운 방식으로 암호화
          upgraded.empl = await encryptData(decryptedEmpl, userId);
        } else {
          // 복호화 실패 시 빈 문자열로 설정
          upgraded.empl = '';
          console.warn('empl: 복호화 실패, 빈 문자열로 설정');
        }
      }
    } catch (error) {
      console.error('empl 업그레이드 오류:', error);
      // 업그레이드 실패 시 빈 문자열로 설정
      upgraded.empl = '';
    }
  }
  
  // userName 업그레이드
  if (encryptedSettings.userName) {
    try {
      let decryptedUserName = '';
      
      // 먼저 AES-GCM으로 복호화 시도 (이미 업그레이드된 경우)
      try {
        decryptedUserName = await decryptData(encryptedSettings.userName, userId);
        if (decryptedUserName && decryptedUserName.trim()) {
          // 이미 AES-GCM으로 암호화된 경우 그대로 유지
          upgraded.userName = encryptedSettings.userName;
        }
      } catch (aesError) {
        // AES-GCM 복호화 실패 시 기존 방식으로 시도
        decryptedUserName = decryptDataLegacy(encryptedSettings.userName);
        if (decryptedUserName && decryptedUserName.trim()) {
          // 레거시 복호화 성공 시 새로운 방식으로 암호화
          upgraded.userName = await encryptData(decryptedUserName, userId);
        } else {
          // 복호화 실패 시 빈 문자열로 설정
          upgraded.userName = '';
          console.warn('userName: 복호화 실패, 빈 문자열로 설정');
        }
      }
    } catch (error) {
      console.error('userName 업그레이드 오류:', error);
      // 업그레이드 실패 시 빈 문자열로 설정
      upgraded.userName = '';
    }
  }
  
  // selectedCurrencyCards는 암호화되지 않으므로 그대로 복사
  if (encryptedSettings.selectedCurrencyCards) {
    upgraded.selectedCurrencyCards = encryptedSettings.selectedCurrencyCards;
  }
  
  return upgraded;
};
