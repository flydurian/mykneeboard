// 파일 해시 기반 최신성 확인 시스템

interface FileHashInfo {
  filename: string;
  hash: string;
  timestamp: number;
}

interface VersionInfo {
  version: string;
  buildTime: string;
  files: FileHashInfo[];
}

// 현재 로드된 파일들의 해시 정보 추출
export const getCurrentFileHashes = (): FileHashInfo[] => {
  const hashes: FileHashInfo[] = [];
  
  // 현재 페이지의 모든 스크립트 태그에서 해시 추출
  const scripts = document.querySelectorAll('script[src]');
  scripts.forEach(script => {
    const src = script.getAttribute('src');
    if (src && src.includes('assets/')) {
      // Vite 해시 패턴: filename.hash.js
      const hashMatch = src.match(/\.([a-f0-9]{8,})\./);
      if (hashMatch) {
        hashes.push({
          filename: src.split('/').pop() || src,
          hash: hashMatch[1],
          timestamp: Date.now()
        });
      }
    }
  });

  // CSS 파일도 확인
  const links = document.querySelectorAll('link[href]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes('assets/')) {
      const hashMatch = href.match(/\.([a-f0-9]{8,})\./);
      if (hashMatch) {
        hashes.push({
          filename: href.split('/').pop() || href,
          hash: hashMatch[1],
          timestamp: Date.now()
        });
      }
    }
  });

  return hashes;
};

// 서버에서 최신 파일 해시 정보 가져오기
export const getLatestFileHashes = async (): Promise<FileHashInfo[]> => {
  try {
    // 메인 HTML 파일을 가져와서 최신 해시 정보 추출
    const response = await fetch('/index.html', {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const hashes: FileHashInfo[] = [];
    
    // HTML에서 스크립트 태그의 해시 추출
    const scriptMatches = html.match(/src="[^"]*\/assets\/[^"]*\.([a-f0-9]{8,})\.[^"]*"/g);
    if (scriptMatches) {
      scriptMatches.forEach(match => {
        const srcMatch = match.match(/src="([^"]*)"/);
        const hashMatch = match.match(/\.([a-f0-9]{8,})\./);
        if (srcMatch && hashMatch) {
          hashes.push({
            filename: srcMatch[1].split('/').pop() || srcMatch[1],
            hash: hashMatch[1],
            timestamp: Date.now()
          });
        }
      });
    }
    
    // HTML에서 CSS 링크의 해시 추출
    const linkMatches = html.match(/href="[^"]*\/assets\/[^"]*\.([a-f0-9]{8,})\.[^"]*"/g);
    if (linkMatches) {
      linkMatches.forEach(match => {
        const hrefMatch = match.match(/href="([^"]*)"/);
        const hashMatch = match.match(/\.([a-f0-9]{8,})\./);
        if (hrefMatch && hashMatch) {
          hashes.push({
            filename: hrefMatch[1].split('/').pop() || hrefMatch[1],
            hash: hashMatch[1],
            timestamp: Date.now()
          });
        }
      });
    }
    
    return hashes;
  } catch (error) {
    console.error('❌ 최신 파일 해시 정보 가져오기 실패:', error);
    return [];
  }
};

// 현재 버전과 최신 버전 비교
export const isLatestVersion = async (): Promise<boolean> => {
  try {
    const currentHashes = getCurrentFileHashes();
    const latestHashes = await getLatestFileHashes();
    
    if (currentHashes.length === 0 || latestHashes.length === 0) {
      console.warn('⚠️ 해시 정보를 가져올 수 없습니다');
      return true; // 정보가 없으면 최신으로 간주
    }
    
    // 메인 파일들의 해시 비교
    const mainFiles = ['index.js', 'index.css', 'App.js', 'App.css'];
    let isLatest = true;
    
    for (const mainFile of mainFiles) {
      const currentFile = currentHashes.find(f => f.filename.includes(mainFile));
      const latestFile = latestHashes.find(f => f.filename.includes(mainFile));
      
      if (currentFile && latestFile) {
        if (currentFile.hash !== latestFile.hash) {
          console.log(`🔄 ${mainFile} 업데이트 감지:`, {
            current: currentFile.hash,
            latest: latestFile.hash
          });
          isLatest = false;
        }
      }
    }
    
    if (isLatest) {
      console.log('✅ 최신 버전입니다');
    } else {
      console.log('🔄 새 버전이 감지되었습니다');
    }
    
    return isLatest;
  } catch (error) {
    console.error('❌ 버전 확인 중 오류:', error);
    return true; // 오류 시 최신으로 간주
  }
};

// 버전 정보를 로컬 스토리지에 저장
export const saveVersionInfo = (hashes: FileHashInfo[]) => {
  const versionInfo: VersionInfo = {
    version: `hash-${Date.now()}`,
    buildTime: new Date().toISOString(),
    files: hashes
  };
  
  try {
    localStorage.setItem('app_version_info', JSON.stringify(versionInfo));
        // 버전 정보 저장 완료
  } catch (error) {
    console.error('❌ 버전 정보 저장 실패:', error);
  }
};

// 로컬 스토리지에서 버전 정보 가져오기
export const getStoredVersionInfo = (): VersionInfo | null => {
  try {
    const stored = localStorage.getItem('app_version_info');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('❌ 저장된 버전 정보 읽기 실패:', error);
    return null;
  }
};

// 자동 업데이트 확인 및 새로고침
export const checkAndUpdate = async (): Promise<boolean> => {
  try {
    const isLatest = await isLatestVersion();
    
    if (!isLatest) {
      console.log('🔄 새 버전 감지! 페이지를 새로고침합니다...');
      
      // 사용자에게 알림
      if (confirm('새 버전이 감지되었습니다. 지금 업데이트하시겠습니까?')) {
        // 캐시 무효화 후 새로고침
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // 오프라인 상태 확인 후 새로고침
        if (!navigator.onLine) {
          console.warn('⚠️ 오프라인 상태로 인해 자동 업데이트를 건너뜁니다.');
          return false;
        }
        
        // 추가적인 네트워크 연결 확인
        try {
          await fetch('/', { method: 'HEAD', cache: 'no-cache' });
        } catch (error) {
          console.warn('⚠️ 네트워크 연결 확인 실패로 자동 업데이트를 건너뜁니다.');
          return false;
        }
        
        // 하드 새로고침
        window.location.reload();
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ 자동 업데이트 확인 중 오류:', error);
    return false;
  }
};
