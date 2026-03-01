import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import dotenv from 'dotenv';

// 강제로 .env.local 로드 (Vercel CLI 버그 대응)
dotenv.config({ path: '.env.local' });

let adminInitError: any = null;
if (!getApps().length) {
    try {
        const sanitizeEnv = (val?: string) => val ? val.trim().replace(/^["']|["']$/g, '') : undefined;

        const projectId = sanitizeEnv(process.env.FIREBASE_PROJECT_ID);
        const clientEmail = sanitizeEnv(process.env.FIREBASE_CLIENT_EMAIL);
        const privateKeyRaw = sanitizeEnv(process.env.FIREBASE_PRIVATE_KEY);
        // vercel dev 에서 사용하는 .env.local 의 실제 \n 문자를 개행으로 치환
        // 만약 Vercel 서버에서 내려준 literal \n이라면 이미 줄바꿈이 되어있을 것이고, 문자열 형태의 \\n 이라면 치환함
        const privateKey = privateKeyRaw ? privateKeyRaw.split('\\n').join('\n') : undefined;
        const databaseURL = sanitizeEnv(process.env.VITE_FIREBASE_DATABASE_URL);

        console.log('초기화 시도 중... Project ID:', projectId);
        console.log('ALL ENV KEYS:', Object.keys(process.env).filter(k => k.includes('FIREBASE')));
        console.log('clientEmail exists?', !!clientEmail);
        console.log('privateKey exists?', !!privateKey);

        initializeApp({
            credential: cert({
                projectId: projectId as string,
                clientEmail: clientEmail as string,
                privateKey: privateKey as string,
            }),
            databaseURL,
        });
        console.log('Firebase Admin SDK 성공적으로 초기화됨');
    } catch (error) {
        adminInitError = error;
        console.error('Firebase Admin Initialization Error:', error);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS configure
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { kakaoAccessToken } = req.body;

    if (!kakaoAccessToken) {
        return res.status(400).json({ error: 'Missing kakaoAccessToken' });
    }

    try {
        // 1. Get User info from Kakao
        const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${kakaoAccessToken}`,
                'Content-type': 'application/x-www-form-urlencoded;charset=utf-8',
            },
        });

        if (!kakaoResponse.ok) {
            const errorText = await kakaoResponse.text();
            console.error('Kakao API Error:', errorText);
            return res.status(kakaoResponse.status).json({ error: 'Failed to fetch user from Kakao' });
        }

        const kakaoUser = await kakaoResponse.json();
        const kakaoUid = kakaoUser.id; // numeric ID

        // Create Firebase UID from Kakao UID
        const firebaseUid = `kakao:${kakaoUid}`;

        // 2. Create custom token
        const customToken = await getAuth().createCustomToken(firebaseUid);

        // 3. kakaoId → Firebase UID 매핑 저장 (친구 추천용)
        try {
            const db = getDatabase();
            await db.ref(`kakaoIdToUid/${kakaoUid}`).set(firebaseUid);
            // 카카오 액세스 토큰 저장 (친구 목록 조회용)
            await db.ref(`users/${firebaseUid}/kakaoAccessToken`).set(kakaoAccessToken);
            console.log(`✅ kakaoId(${kakaoUid}) → UID(${firebaseUid}) 매핑 및 토큰 저장 완료`);
        } catch (dbError) {
            console.warn('⚠️ kakaoId 매핑/토큰 저장 실패 (무시됨):', dbError);
        }

        return res.status(200).json({ customToken, firebaseUid });

    } catch (error: any) {
        console.error('Auth Error Details:', error);

        // Firebase Auth 연동 중 발생한 에러인지 체크
        if (error.codePrefix === 'auth') {
            console.error('Firebase Admin SDK Auth Error:', error.code, error.message);
        }

        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message || String(error),
            adminInitialized: getApps().length > 0,
            adminInitError: adminInitError ? String(adminInitError) : null
        });
    }
}

