// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Firebase 설정 검증
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  // 개발 환경에서만 경고 표시
  if ((import.meta as any).env?.DEV) {
    console.warn('⚠️ Firebase 환경변수 누락:', missingVars.length + '개');
  }
}

// Firebase 초기화 (환경변수 누락 시에도 기본값으로 시도)
let app = null;
let analytics = null;
let database = null;
let auth = null;

console.log('🚀 Firebase 초기화 시작...');

try {
  // 환경변수가 없어도 기본값으로 Firebase 초기화 시도
  const configWithDefaults = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://demo-project-default-rtdb.firebaseio.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XXXXXXXXXX'
  };
  
  console.log('🔍 Firebase 설정:', {
    apiKey: configWithDefaults.apiKey ? '설정됨' : '없음',
    authDomain: configWithDefaults.authDomain,
    databaseURL: configWithDefaults.databaseURL,
    projectId: configWithDefaults.projectId
  });
  
  app = initializeApp(configWithDefaults);
  console.log('✅ Firebase App 초기화 완료');
  
  // Analytics 초기화 (지원되는 환경에서만)
  isSupported().then(yes => yes ? analytics = getAnalytics(app) : null);
  
  // Database 및 Auth 초기화
  database = getDatabase(app);
  auth = getAuth(app);
  console.log('✅ Firebase Database 및 Auth 초기화 완료');
  
  if (missingVars.length > 0) {
    console.warn('⚠️ 기본값으로 Firebase 초기화됨 (실제 연결 불가)');
  } else {
    console.log('✅ 모든 Firebase 환경변수가 설정됨');
  }
} catch (error) {
  console.error('❌ Firebase 초기화 실패:', error);
  console.error('❌ 오류 상세:', error instanceof Error ? error.stack : error);
}

export { app, analytics, database, auth };
