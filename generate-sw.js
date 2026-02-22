
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const swContent = `// Auto-generated at build time — do not edit manually
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "${process.env.VITE_FIREBASE_API_KEY || ''}",
    authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN || ''}",
    databaseURL: "${process.env.VITE_FIREBASE_DATABASE_URL || ''}",
    projectId: "${process.env.VITE_FIREBASE_PROJECT_ID || ''}",
    storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET || ''}",
    messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}",
    appId: "${process.env.VITE_FIREBASE_APP_ID || ''}",
    measurementId: "${process.env.VITE_FIREBASE_MEASUREMENT_ID || ''}"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192x192.png',
        requireInteraction: true,
        tag: 'show-up-alarm',
        renotify: true
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
`;

const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
fs.writeFileSync(swPath, swContent);
console.log('Generated firebase-messaging-sw.js from environment variables');
