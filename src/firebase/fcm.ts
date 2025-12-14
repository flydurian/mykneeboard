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
            // 2. Get Token
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // Optional: Public VAPID Key if configured
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
