import { getToken } from "firebase/messaging";
import { ref, set, get } from "firebase/database";
import { messaging, database } from "./config";

export async function requestFcmToken(userId: string) {
    if (!messaging) {
        console.log('FCM Messaging not initialized (not supported or offline)');
        return null;
    }

    try {
        // 1. Notification Permission Request
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // 2. Get Token (Wait for service worker registration before getting token)
            let registration;
            if ('serviceWorker' in navigator) {
                // Wait until the service worker is registered
                registration = await navigator.serviceWorker.ready;

                // [버그 픽스] Service Worker가 ready 상태여도 active worker가 없으면 PushManager 구독이 취소됨
                // 따라서 registration.active가 완전히 존재할 때까지 대기
                if (!registration.active) {
                    console.log('🚧 Service Worker is not active yet, waiting...');
                    await new Promise<void>((resolve) => {
                        const checkInterval = setInterval(() => {
                            if (registration?.active) {
                                clearInterval(checkInterval);
                                resolve();
                            }
                        }, 100);
                        // 최대 3초 대기 후 강제 진행 (무한 루프 방지)
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            resolve();
                        }, 3000);
                    });
                }
            }

            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, // Optional: Public VAPID Key if configured
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('FCM Token:', token);

                // 3. Save to RTDB (Users -> FCM Tokens)
                // Store as a map for easy addition/removal: users/{userId}/fcmTokens/{token} = true
                // Sanitize token for path key usage (though tokens are usually safe URL strings)
                await set(ref(database, `users/${userId}/fcmTokens/${token}`), {
                    lastUpdated: new Date().toISOString(),
                    device: navigator.userAgent
                });

                return token;
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
    }
    return null;
}
