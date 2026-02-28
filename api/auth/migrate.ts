import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
    try {
        const sanitizeEnv = (val?: string) => val ? val.trim().replace(/^["']|["']$/g, '') : undefined;

        const projectId = sanitizeEnv(process.env.FIREBASE_PROJECT_ID);
        const clientEmail = sanitizeEnv(process.env.FIREBASE_CLIENT_EMAIL);
        const privateKeyRaw = sanitizeEnv(process.env.FIREBASE_PRIVATE_KEY);
        const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : undefined;
        // Vercel 환경 변수가 없을 경우 .env 폴백을 위해 DB URL 직접 로드
        const databaseURL = sanitizeEnv(process.env.VITE_FIREBASE_DATABASE_URL);

        initializeApp({
            credential: cert({
                projectId: projectId as string,
                clientEmail: clientEmail as string,
                privateKey: privateKey as string,
            }),
            databaseURL: databaseURL as string
        });
    } catch (error) {
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

    const { oldUid, newUid } = req.body;

    if (!oldUid || !newUid) {
        return res.status(400).json({ error: 'Missing oldUid or newUid' });
    }

    if (oldUid === newUid) {
        return res.status(200).json({ success: true, message: 'Same UIDs, no migration needed' });
    }

    try {
        const db = getDatabase();

        // 1. 순회하며 복사해야 할 유저 키 기반 컬렉션 루트 경로 목록
        const userKeyCollections = [
            'users',
            'flights',
            'memos',
            'cityMemos',
            'qualificationStatus',
            'userSessions'
        ];

        let hasAnyData = false;

        // 유저 키 기반 데이터 복사 및 삭제
        for (const collection of userKeyCollections) {
            const oldRef = db.ref(`${collection}/${oldUid}`);
            const snapshot = await oldRef.get();

            if (snapshot.exists()) {
                hasAnyData = true;
                const data = snapshot.val();
                const newRef = db.ref(`${collection}/${newUid}`);
                await newRef.set(data);
                await oldRef.remove();
                console.log(`[마이그레이션 성공] ${collection}/${oldUid} -> ${newUid} 이동 완료`);
            }
        }

        // 2. schedules (날짜/uid/flightId) 형태의 데이터 마이그레이션
        // 모든 날짜를 순회하는 대신, 비효율을 피하기 위해 일단 루트를 읽음 (데이터가 많지 않을 경우)
        const schedulesRef = db.ref('schedules');
        const schedulesSnap = await schedulesRef.get();
        if (schedulesSnap.exists()) {
            const allSchedules = schedulesSnap.val();
            for (const date in allSchedules) {
                if (allSchedules[date][oldUid]) {
                    hasAnyData = true;
                    const data = allSchedules[date][oldUid];
                    await db.ref(`schedules/${date}/${newUid}`).set(data);
                    await db.ref(`schedules/${date}/${oldUid}`).remove();
                    console.log(`[마이그레이션 성공] schedules/${date}/${oldUid} -> ${newUid} 이동 완료`);
                }
            }
        }

        // 3. 다른 유저들의 친구 목록/요청에서 구 UID를 새 UID로 업데이트
        const usersRef = db.ref('users');
        const usersSnap = await usersRef.get();
        if (usersSnap.exists()) {
            const allUsers = usersSnap.val();
            const updates: { [key: string]: any } = {};

            for (const otherUid in allUsers) {
                if (otherUid === oldUid || otherUid === newUid) continue;

                // 친구 목록 업데이트
                if (allUsers[otherUid].friends && allUsers[otherUid].friends[oldUid]) {
                    const friendData = allUsers[otherUid].friends[oldUid];
                    updates[`users/${otherUid}/friends/${newUid}`] = friendData;
                    updates[`users/${otherUid}/friends/${oldUid}`] = null;
                    hasAnyData = true;
                }

                // 친구 요청 업데이트
                if (allUsers[otherUid].friendRequests && allUsers[otherUid].friendRequests[oldUid]) {
                    const requestData = allUsers[otherUid].friendRequests[oldUid];
                    updates[`users/${otherUid}/friendRequests/${newUid}`] = requestData;
                    updates[`users/${otherUid}/friendRequests/${oldUid}`] = null;
                    hasAnyData = true;
                }
            }

            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                console.log(`[마이그레이션 성공] ${Object.keys(updates).length / 2}명의 친구 관계 업데이트 완료`);
            }
        }

        if (!hasAnyData) {
            return res.status(200).json({ success: true, message: 'No old data found in any collection. Migration skipped.' });
        }

        // 4. 구 UID 사용자 인증 계정 삭제 (Firebase Auth)
        try {
            const { getAuth } = await import('firebase-admin/auth');
            await getAuth().deleteUser(oldUid);
            console.log(`🗑️ Auth 계정 삭제 완료: ${oldUid}`);
        } catch (authError) {
            console.warn(`Auth 계정 삭제 실패 (이미 없는 계정일 수 있음): ${oldUid}`, authError);
        }

        return res.status(200).json({ success: true, message: '마이그레이션 및 이전 계정 완전 삭제 성공' });
    } catch (error: any) {
        console.error('Migration Error Details:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message || String(error)
        });
    }
}
