import { useEffect, useState, useRef, FC } from 'react';
import { auth } from '../src/firebase/config';
import { signInWithCustomToken, deleteUser } from 'firebase/auth';
import { migrateAccountData } from '../src/firebase/database';

interface KakaoCallbackProps {
    onSuccess: () => void;
    onError: (error: string) => void;
}

const KakaoCallback: FC<KakaoCallbackProps> = ({ onSuccess, onError }) => {
    const [status, setStatus] = useState('카카오 로그인 처리 중...');
    const isProcessing = useRef(false);

    useEffect(() => {
        const processKakaoLogin = async (code: string | null, error: string | null) => {
            if (isProcessing.current) return;
            isProcessing.current = true;

            try {
                if (error) {
                    throw new Error(`카카오 로그인 에러: ${error}`);
                }

                if (!code) {
                    throw new Error('인증 코드가 없습니다.');
                }

                setStatus('카카오 토큰 발급 중...');

                // 2. 카카오 토큰 발급 (REST API)
                const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
                if (!REST_API_KEY) {
                    throw new Error('카카오 REST API 키가 설정되지 않았습니다.');
                }
                const REDIRECT_URI = window.location.origin + '/auth/kakao/callback'; // 현재 호스트 동적 맵핑

                const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        client_id: REST_API_KEY,
                        redirect_uri: REDIRECT_URI,
                        code: code,
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json().catch(() => ({}));
                    console.error('카카오 토큰 발급 실패 상세:', errorData);
                    throw new Error(`카카오 토큰 발급에 실패했습니다. (${errorData.error_code || tokenResponse.status}: ${errorData.error_description || '(상세 설명 없음)'})`);
                }

                const tokenData = await tokenResponse.json();
                const kakaoAccessToken = tokenData.access_token;
                const kakaoRefreshToken = tokenData.refresh_token;

                setStatus('Firebase 인증 중...');

                // 3. Vercel 백엔드로 토큰 전송하여 Firebase Custom Token 획득
                const backendOrigin = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
                // 환경에 따라 API 주소 맞춤 (Vite 로컬 구동 시 API 서버 주소가 다를 수 있음 주의, 
                // Vercel CLI 로컬 dev 시에는 같은 포트)
                const apiResponse = await fetch(`${backendOrigin}/api/auth/kakao`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ kakaoAccessToken, kakaoRefreshToken }),
                });

                if (!apiResponse.ok) {
                    const errData = await apiResponse.json().catch(() => ({}));
                    const errorMessage = errData.details
                        ? `서버 에러(${errData.error}): ${errData.details}`
                        : (errData.error || 'Firebase 인증 토큰을 받아오지 못했습니다.');
                    throw new Error(errorMessage);
                }

                const apiData = await apiResponse.json();
                const customToken = apiData.customToken;

                // [중요] 로그인 전의 기존 유저 정보를 저장해둠 (로컬 스토리지 또는 세션에서)
                const oldUser = auth.currentUser;
                const oldUid = localStorage.getItem('migration_old_uid') || oldUser?.uid;

                // 4. Firebase Custom Token 로그인 반영
                setStatus('로그인 완료 중...');
                const userCredential = await signInWithCustomToken(auth, customToken);
                const newUid = userCredential.user.uid;

                // 5. 마이그레이션이 필요한지 판별 (기존 이메일 계정의 UID가 존재할 때, 새 카카오 계정으로 넘어감)
                if (oldUid && oldUid !== newUid) {
                    setStatus('기존 데이터를 안전하게 이전 중입니다... (창을 닫지 마세요)');
                    const isSuccess = await migrateAccountData(oldUid, newUid);

                    if (!isSuccess) {
                        throw new Error('데이터 이전 중 알 수 없는 오류가 발생했습니다. 개발자에게 문의해주세요.');
                    }

                    // [수정] 성공적으로 마이그레이션을 마친 후 migration_old_uid를 바로 삭제합니다.
                    // 메모 복호화 등은 indexedDB 캐시를 통해 마이그레이션이 완료되거나, 새로 로그인될 때 다시 이루어지기 때문에
                    // 여기서 삭제해야 매번 로그인할 때마다 불필요한 마이그레이션 로직을 타지 않습니다.
                    localStorage.removeItem('migration_old_uid');

                    // [버그 방어] 이전 이메일 계정 시절의 IndexedDB 캐시 찌꺼기가 새 카카오 계정의 DB 검색을 방해하지 못하도록 강제 초기화
                    try {
                        const { indexedDBCache } = await import('../utils/indexedDBCache');
                        await indexedDBCache.clearCache(newUid);
                        console.log('🧹 마이그레이션 완료 후 로컬 IndexedDB 캐시 초기화 성공');
                    } catch (cacheErr) {
                        console.warn('⚠️ 로컬 캐시 초기화 실패 (무시됨):', cacheErr);
                    }

                    if (oldUser) {
                        try {
                            setStatus('기존 이메일 계정 기기에서 삭제 중...');
                            await deleteUser(oldUser);
                            console.log('🗑️ 이전 이메일 Auth 계정 로그아웃/삭제가 완료되었습니다.');
                        } catch (deleteErr) {
                            console.warn('⚠️ 보안 정책으로 이전 계정을 클라이언트에서 자동 삭제하지 못했습니다. (데이터 정상 이전됨):', deleteErr);
                        }
                    }
                } else {
                    // 마이그레이션이 없는 일반 신규 로그인 시에도 찌꺼기 캐시 비우기
                    try {
                        const { indexedDBCache } = await import('../utils/indexedDBCache');
                        await indexedDBCache.clearCache(newUid);
                    } catch (e) {
                        // ignore
                    }
                }

                // 6. 성공 콜백 (URL 정리 및 하드 리프레시를 통한 캐시 클리어)
                // React-Query의 인메모리 캐시 찌꺼기가 남아서 기존 빈 화면이 보이는 현상 방지
                window.location.href = '/';
                // onSuccess(); // 하드 리프레시로 인해 불필요함

            } catch (err: any) {
                console.error('KakaoLogin Error:', err);
                const errorMessage = err.message || '카카오 로그인 중 오류가 발생했습니다.';
                setStatus(`[에러 발생]\n${errorMessage}\n\n※ 콘솔창(F12)을 캡처해 주세요! 화면이 1분 뒤에 넘어갑니다.`);
                onError(errorMessage);

                // 에러 발생 시 사용자가 콘솔 로그를 캡처할 수 있도록 리다이렉트를 60초로 매우 길게 늦춥니다.
                setTimeout(() => {
                    window.location.href = '/';
                }, 60000);
            }
        };

        // React StrictMode 더블 렌더링 방지를 위해 code가 있을 때만 실행
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (code || error) {
            // StrictMode에서 두 번째 렌더링 시 코드를 재사용하지 않도록 즉시 URL 정리
            window.history.replaceState({}, document.title, window.location.pathname);
            processKakaoLogin(code, error);
        }
    }, [onSuccess, onError]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="glass-panel rounded-2xl p-8 w-full max-w-lg text-center">
                {status.includes('[에러 발생]') ? (
                    <div className="mb-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <svg className="h-10 w-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">로그인 처리 중 오류 발생</h2>
                    </div>
                ) : (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">로그인 처리중</h2>
                    </>
                )}

                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono text-sm break-all text-left bg-black/5 dark:bg-white/5 p-4 rounded-xl mt-4">
                    {status}
                </p>
                {status.includes('[에러 발생]') && (
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-6 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        홈으로 돌아가기
                    </button>
                )}
            </div>
        </div>
    );
};

export default KakaoCallback;
