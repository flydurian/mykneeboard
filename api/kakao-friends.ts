import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Firebase Admin 초기화
if (!getApps().length) {
    try {
        const sanitizeEnv = (val?: string) => val ? val.trim().replace(/^["']|["']$/g, '') : undefined;
        const projectId = sanitizeEnv(process.env.FIREBASE_PROJECT_ID);
        const clientEmail = sanitizeEnv(process.env.FIREBASE_CLIENT_EMAIL);
        const privateKeyRaw = sanitizeEnv(process.env.FIREBASE_PRIVATE_KEY);
        const privateKey = privateKeyRaw ? privateKeyRaw.split('\\n').join('\n') : undefined;
        const databaseURL = sanitizeEnv(process.env.VITE_FIREBASE_DATABASE_URL);

        initializeApp({
            credential: cert({
                projectId: projectId as string,
                clientEmail: clientEmail as string,
                privateKey: privateKey as string,
            }),
            databaseURL,
        });
    } catch (error) {
        console.error('Firebase Admin Init Error:', error);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    const allowedOrigins = ['https://mykneeboard.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { userId } = req.query;
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId가 필요합니다.' });
        }

        const db = getDatabase();

        // 1. 사용자의 카카오 액세스 토큰 조회
        const tokenSnap = await db.ref(`users/${userId}/kakaoAccessToken`).get();
        if (!tokenSnap.exists()) {
            return res.status(200).json({ success: true, friends: [], message: '카카오 토큰이 없습니다.' });
        }
        let kakaoAccessToken = tokenSnap.val();

        // 카카오 친구 목록 API 호출 (토큰 자동 갱신 포함)
        const fetchFriends = async (token: string) => {
            return fetch('https://kapi.kakao.com/v1/api/talk/friends', {
                headers: { Authorization: `Bearer ${token}` },
            });
        };

        let kakaoResponse = await fetchFriends(kakaoAccessToken);

        // 토큰 만료 시 (401) → refresh token으로 자동 갱신
        if (kakaoResponse.status === 401) {
            console.log('🔄 카카오 액세스 토큰 만료, 리프레시 토큰으로 갱신 시도...');
            const refreshSnap = await db.ref(`users/${userId}/kakaoRefreshToken`).get();
            if (!refreshSnap.exists()) {
                return res.status(200).json({
                    success: false,
                    friends: [],
                    error: '카카오 토큰이 만료되었고 리프레시 토큰이 없습니다. 다시 로그인해주세요.'
                });
            }

            const REST_API_KEY = process.env.VITE_KAKAO_REST_API_KEY?.trim().replace(/^["']|["']$/g, '');
            if (!REST_API_KEY) {
                return res.status(200).json({
                    success: false,
                    friends: [],
                    error: '서버에 카카오 REST API KEY가 설정되지 않았습니다.'
                });
            }

            const refreshResponse = await fetch('https://kauth.kakao.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: REST_API_KEY,
                    refresh_token: refreshSnap.val(),
                }),
            });

            if (!refreshResponse.ok) {
                const refreshErr = await refreshResponse.json().catch(() => ({}));
                console.error('❌ 카카오 토큰 갱신 실패:', refreshResponse.status, JSON.stringify(refreshErr));
                return res.status(200).json({
                    success: false,
                    friends: [],
                    error: '카카오 토큰 갱신에 실패했습니다. 다시 로그인해주세요.'
                });
            }

            const newTokenData = await refreshResponse.json();
            kakaoAccessToken = newTokenData.access_token;

            // 갱신된 토큰을 Firebase DB에 저장
            await db.ref(`users/${userId}/kakaoAccessToken`).set(kakaoAccessToken);
            // refresh token도 갱신된 경우 업데이트 (만료 1개월 전부터 새 refresh token이 발급됨)
            if (newTokenData.refresh_token) {
                await db.ref(`users/${userId}/kakaoRefreshToken`).set(newTokenData.refresh_token);
            }
            console.log('✅ 카카오 토큰 갱신 성공');

            // 갱신된 토큰으로 친구 목록 재호출
            kakaoResponse = await fetchFriends(kakaoAccessToken);
        }

        if (!kakaoResponse.ok) {
            const errData = await kakaoResponse.json().catch(() => ({}));
            console.error('카카오 친구 API 에러:', kakaoResponse.status, JSON.stringify(errData));
            // 권한 부족 (403)
            if (kakaoResponse.status === 403) {
                return res.status(200).json({
                    success: false,
                    friends: [],
                    error: `카카오 친구 API 권한이 없습니다. 카카오 검수가 필요합니다. (${errData?.code || kakaoResponse.status})`
                });
            }
            return res.status(200).json({
                success: false,
                friends: [],
                error: `카카오 친구 API 오류 (${kakaoResponse.status}): ${errData?.msg || errData?.message || '알 수 없는 오류'}`
            });
        }

        const kakaoData = await kakaoResponse.json();
        const kakaoFriends = kakaoData.elements || [];

        if (kakaoFriends.length === 0) {
            return res.status(200).json({ success: true, friends: [], message: '카카오 친구가 없거나 동의하지 않았습니다.' });
        }

        // 3. 카카오 친구들의 kakaoId로 앱 사용자 검색
        const appFriends: any[] = [];

        // 현재 사용자의 친구 목록 조회 (이미 친구인 사람 제외)
        const myFriendsSnap = await db.ref(`users/${userId}/friends`).get();
        const myFriendUids = myFriendsSnap.exists() ? Object.keys(myFriendsSnap.val()) : [];

        // 보낸 친구 요청 확인 (이미 요청 보낸 사람 제외)
        const sentRequestUids: string[] = [];

        for (const friend of kakaoFriends) {
            const kakaoId = String(friend.id);

            // kakaoIdToUid 매핑에서 Firebase UID 찾기
            const uidSnap = await db.ref(`kakaoIdToUid/${kakaoId}`).get();
            if (!uidSnap.exists()) continue;

            const friendUid = uidSnap.val();

            // 자기 자신 제외
            if (friendUid === userId) continue;

            // 이미 친구인 사람 제외
            if (myFriendUids.includes(friendUid)) continue;

            // 이미 요청 보낸 사람 확인
            const requestSnap = await db.ref(`users/${friendUid}/friendRequests/${userId}`).get();
            if (requestSnap.exists()) {
                sentRequestUids.push(friendUid);
                continue;
            }

            // 프로필 정보 가져오기
            const [displayNameSnap, settingsSnap] = await Promise.all([
                db.ref(`users/${friendUid}/displayName`).get(),
                db.ref(`users/${friendUid}/settings`).get(),
            ]);

            const displayName = displayNameSnap.exists() ? displayNameSnap.val() : null;
            const settings = settingsSnap.exists() ? settingsSnap.val() : {};
            const userName = settings.userName || displayName || friend.profile_nickname || '사용자';
            const company = settings.airline || settings.company || '';

            appFriends.push({
                uid: friendUid,
                kakaoNickname: friend.profile_nickname || '',
                kakaoProfileImage: friend.profile_thumbnail_image || '',
                displayName: userName,
                company,
            });
        }

        return res.status(200).json({
            success: true,
            friends: appFriends,
            totalKakaoFriends: kakaoFriends.length,
        });

    } catch (error: any) {
        console.error('카카오 친구 조회 오류:', error);
        return res.status(500).json({ error: '카카오 친구 조회 실패', details: error.message });
    }
}
