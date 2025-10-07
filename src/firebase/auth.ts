import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  User,
  AuthError,
  EmailAuthProvider,
  reauthenticateWithCredential,
  Unsubscribe
} from "firebase/auth";
import { auth } from "./config";
import { ref, set, get } from "firebase/database";
import { database } from "./config";

// Firebase 인증 리스너 관리
let authUnsubscribe: Unsubscribe | null = null;
let isOnline = navigator.onLine;

// 오프라인 인증을 위한 로컬 스토리지 키
const OFFLINE_AUTH_KEY = 'offline_auth_data';
const OFFLINE_USER_KEY = 'offline_user_data';

// 오프라인 인증 데이터 타입
interface OfflineAuthData {
  uid: string;
  email: string;
  displayName: string;
  company: string;
  empl?: string;
  userName?: string;
  loginTime: number;
  isOfflineMode: boolean;
}

// 사용자 상태 타입 정의 (Firebase Authentication 기본 상태 사용)
export type UserStatus = 'approved'; // 모든 사용자는 기본적으로 승인됨

// 오프라인 인증 데이터 저장
const saveOfflineAuthData = (userData: OfflineAuthData): void => {
  try {
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('❌ 오프라인 인증 데이터 저장 실패:', error);
  }
};

// 오프라인 인증 데이터 가져오기
const getOfflineAuthData = (): OfflineAuthData | null => {
  try {
    const data = localStorage.getItem(OFFLINE_AUTH_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      // 7일 이내의 데이터만 유효
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsedData.loginTime < sevenDaysInMs) {
        return parsedData;
      } else {
        // 만료된 데이터 삭제
        localStorage.removeItem(OFFLINE_AUTH_KEY);
        localStorage.removeItem(OFFLINE_USER_KEY);
      }
    }
    return null;
  } catch (error) {
    console.error('❌ 오프라인 인증 데이터 읽기 실패:', error);
    return null;
  }
};

// 오프라인 인증 데이터 삭제
const clearOfflineAuthData = (): void => {
  try {
    localStorage.removeItem(OFFLINE_AUTH_KEY);
    localStorage.removeItem(OFFLINE_USER_KEY);
  } catch (error) {
    console.error('❌ 오프라인 인증 데이터 삭제 실패:', error);
  }
};

// 오프라인 사용자 객체 생성 (Firebase User와 유사한 구조)
const createOfflineUser = (authData: OfflineAuthData): User => {
  return {
    uid: authData.uid,
    email: authData.email,
    displayName: authData.displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: authData.loginTime.toString(),
      lastSignInTime: authData.loginTime.toString()
    },
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({})
  } as User;
};

// 사용자 정보 가져오기 함수 (Firebase Authentication + settings 사용, 오프라인 지원)
export const getUserInfo = async (uid: string): Promise<{status: UserStatus | null, email: string, displayName: string, company: string, empl?: string, userName?: string} | null> => {
  try {
    
    // 오프라인 모드인 경우 로컬 스토리지에서 데이터 가져오기
    if (!isOnline) {
      const offlineData = getOfflineAuthData();
      if (offlineData && offlineData.uid === uid) {
        return {
          status: 'approved',
          email: offlineData.email,
          displayName: offlineData.displayName,
          company: offlineData.company,
          empl: offlineData.empl,
          userName: offlineData.userName
        };
      }
      return null;
    }
    
    // 온라인 모드: Firebase Authentication에서 기본 정보 가져오기
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      console.error('❌ 현재 사용자와 UID가 일치하지 않음');
      return null;
    }
    
    // settings에서 회사 정보 가져오기
    const settingsRef = ref(database, `users/${uid}/settings`);
    const settingsSnapshot = await get(settingsRef);
    
    
    let result: {status: UserStatus | null, email: string, displayName: string, company: string, empl?: string, userName?: string} = {
      status: 'approved', // 모든 사용자는 기본적으로 승인됨
      email: user.email || '',
      displayName: user.displayName || '',
      company: 'OZ', // 기본값
      empl: '',
      userName: ''
    };
    
    // settings 데이터가 있으면 회사 정보 및 EMPL ID 업데이트 (암호화 없음)
    if (settingsSnapshot.exists()) {
      const settingsData = settingsSnapshot.val();
      
      if (settingsData.airline) {
        result.company = settingsData.airline;
      }
      if (settingsData.empl) {
        result.empl = settingsData.empl;
      }
      if (settingsData.userName) {
        result.userName = settingsData.userName;
      }
    }
    
    // 온라인 로그인 성공 시 오프라인 데이터 저장
    const offlineAuthData: OfflineAuthData = {
      uid: user.uid,
      email: result.email,
      displayName: result.displayName,
      company: result.company,
      empl: result.empl,
      userName: result.userName,
      loginTime: Date.now(),
      isOfflineMode: false
    };
    saveOfflineAuthData(offlineAuthData);
    
    return result;
  } catch (error) {
    console.error('❌ 사용자 정보 확인 오류:', error);
    
    // 오류 발생 시 오프라인 데이터로 폴백
    const offlineData = getOfflineAuthData();
    if (offlineData && offlineData.uid === uid) {
      return {
        status: 'approved',
        email: offlineData.email,
        displayName: offlineData.displayName,
        company: offlineData.company,
        empl: offlineData.empl,
        userName: offlineData.userName
      };
    }
    
    return null;
  }
};


// 네트워크 오류 감지 함수
const isNetworkError = (error: any): boolean => {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  
  return (
    errorMessage.includes('net::ERR_INTERNET_DISCONNECTED') ||
    errorMessage.includes('net::ERR_NETWORK_CHANGED') ||
    errorMessage.includes('net::ERR_NAME_NOT_RESOLVED') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('Network request failed') ||
    errorCode === 'auth/network-request-failed' ||
    errorCode === 'auth/too-many-requests'
  );
};

// 로그인 함수
export const loginUser = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // 네트워크 상태 확인
    if (!isOnline) {
      return { success: false, error: "네트워크 연결을 확인해주세요." };
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Firebase Authentication을 통한 로그인 성공 (모든 사용자 허용)
    
    // 모든 사용자 로그인 허용 (승인 시스템 제거)
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    
    // 네트워크 오류인 경우 특별 처리
    if (isNetworkError(authError)) {
      isOnline = false;
      stopFirebaseListener();
      return { success: false, error: "인터넷 연결을 확인해주세요." };
    }
    
    let errorMessage = "로그인에 실패했습니다.";
    
    switch (authError.code) {
      case 'auth/user-not-found':
        errorMessage = "등록되지 않은 이메일입니다.";
        break;
      case 'auth/wrong-password':
        errorMessage = "비밀번호가 올바르지 않습니다.";
        break;
      case 'auth/invalid-email':
        errorMessage = "유효하지 않은 이메일 형식입니다.";
        break;
      case 'auth/invalid-credential':
        errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
        break;
      case 'auth/too-many-requests':
        errorMessage = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
        break;
      default:
        errorMessage = authError.message || "로그인에 실패했습니다.";
    }
    
    return { success: false, error: errorMessage };
  }
};

// 회원가입 함수 (바로 사용 가능)
export const registerUser = async (email: string, password: string, displayName: string, company: string, empl?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // 네트워크 상태 확인
    if (!isOnline) {
      return { success: false, error: "네트워크 연결을 확인해주세요." };
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 사용자 프로필 업데이트 (사용자 이름 설정)
    await updateProfile(user, {
      displayName: displayName
    });
    
    // 모든 회원가입 시 사용자 정보를 settings에 저장
    const { saveUserSettings } = await import('./database');
    const settingsData: { airline: string; userName: string; empl?: string } = {
      airline: company,
      userName: displayName
    };
    
    // KE 회원가입 시 EMPL ID도 저장
    if (company === 'KE' && empl) {
      settingsData.empl = empl;
    }
    
    // 7C 회원가입 시 제주항공 로고 적용을 위한 설정 저장
    if (company === '7C') {
      settingsData.airline = '7C'; // 제주항공 코드로 설정
    }
    
    await saveUserSettings(user.uid, settingsData);
    
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    
    // 네트워크 오류인 경우 특별 처리
    if (isNetworkError(authError)) {
      isOnline = false;
      stopFirebaseListener();
      return { success: false, error: "인터넷 연결을 확인해주세요." };
    }
    
    let errorMessage = "회원가입에 실패했습니다.";
    
    switch (authError.code) {
      case 'auth/email-already-in-use':
        errorMessage = "이미 사용 중인 이메일입니다.";
        break;
      case 'auth/weak-password':
        errorMessage = "비밀번호가 너무 약합니다. 6자 이상으로 설정해주세요.";
        break;
      case 'auth/invalid-email':
        errorMessage = "유효하지 않은 이메일 형식입니다.";
        break;
      default:
        errorMessage = authError.message || "회원가입에 실패했습니다.";
    }
    
    return { success: false, error: errorMessage };
  }
};

// 로그아웃 함수 (오프라인 지원 + 모든 사용자 데이터 삭제)
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // 현재 사용자 ID 가져오기 (데이터 삭제용)
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid;
    
    // 오프라인 데이터 삭제 (온라인/오프라인 관계없이)
    clearOfflineAuthData();
    
    // 모든 사용자 데이터 삭제 (테마 설정 제외)
    try {
      const { clearAllUserData } = await import('../../utils/logoutDataCleanup');
      await clearAllUserData(userId);
    } catch (dataCleanupError) {
      console.error('❌ 사용자 데이터 삭제 중 오류:', dataCleanupError);
      // 데이터 삭제 실패해도 로그아웃은 계속 진행
    }
    
    // 네트워크 상태 확인
    if (!isOnline) {
      return { success: true };
    }
    
    await signOut(auth);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    
    // 네트워크 오류인 경우 특별 처리
    if (isNetworkError(authError)) {
      isOnline = false;
      stopFirebaseListener();
      // 오프라인 데이터는 이미 삭제됨
      return { success: true };
    }
    
    return { success: false, error: authError.message || "로그아웃에 실패했습니다." };
  }
};

// 1. 온라인 상태일 때 Firebase 연결 시작 함수
function startFirebaseListener(callback: (user: User | null) => void) {
  // onAuthStateChanged는 사용자의 로그인 상태 변화를 감지합니다.
  // 이 함수는 한 번만 실행되어야 하므로, 기존 구독이 있다면 해제합니다.
  if (!authUnsubscribe) {
    authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
      } else {
      }
      callback(user);
    });
  }
}

// 2. 오프라인 상태일 때 Firebase 연결 중지 함수
function stopFirebaseListener() {
  // 구독 해제 함수(authUnsubscribe)가 존재하면 실행하여 리스너를 제거합니다.
  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null; // 변수 초기화
  }
}

// 3. 브라우저의 온라인/오프라인 이벤트에 함수 연결
function setupNetworkListeners(callback: (user: User | null) => void) {
  window.addEventListener('online', () => {
    isOnline = true;
    startFirebaseListener(callback);
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    stopFirebaseListener();
  });
}

// 인증 상태 변경 감지 (온라인/오프라인 감지 포함)
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  // 네트워크 이벤트 리스너 설정
  setupNetworkListeners(callback);
  
  // 4. 앱 시작 시 초기 상태 확인
  if (navigator.onLine) {
    startFirebaseListener(callback);
  } else {
    stopFirebaseListener();
    // 오프라인 상태에서 로컬 스토리지 확인
    const offlineData = getOfflineAuthData();
    if (offlineData) {
      const offlineUser = createOfflineUser(offlineData);
      callback(offlineUser);
    } else {
      callback(null);
    }
  }
  
  // 기존 구독 해제 함수 반환
  return () => {
    stopFirebaseListener();
  };
};

// 현재 사용자 가져오기 (오프라인 지원)
export const getCurrentUser = (): User | null => {
  if (isOnline) {
    return auth.currentUser;
  } else {
    // 오프라인 모드에서 로컬 스토리지 확인
    const offlineData = getOfflineAuthData();
    if (offlineData) {
      return createOfflineUser(offlineData);
    }
    return null;
  }
};

// 네트워크 상태 확인
export const isNetworkOnline = (): boolean => {
  return isOnline;
};

// Firebase 인증 리스너 상태 확인
export const isAuthListenerActive = (): boolean => {
  return authUnsubscribe !== null;
};

// 사용자 이름 변경 함수
export const updateUserName = async (newDisplayName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    await updateProfile(user, {
      displayName: newDisplayName
    });

    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return { success: false, error: authError.message || "이름 변경에 실패했습니다." };
  }
};

// 비밀번호 변경 함수
export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 현재 비밀번호로 재인증
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // 새 비밀번호로 업데이트
    await updatePassword(user, newPassword);

    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    let errorMessage = "비밀번호 변경에 실패했습니다.";
    
    switch (authError.code) {
      case 'auth/wrong-password':
        errorMessage = "현재 비밀번호가 올바르지 않습니다.";
        break;
      case 'auth/weak-password':
        errorMessage = "새 비밀번호가 너무 약합니다. 6자 이상으로 설정해주세요.";
        break;
      case 'auth/requires-recent-login':
        errorMessage = "보안을 위해 다시 로그인해주세요.";
        break;
      default:
        errorMessage = authError.message || "비밀번호 변경에 실패했습니다.";
    }
    
    return { success: false, error: errorMessage };
  }
};

// 비밀번호 재설정 이메일 발송 함수
export const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // 네트워크 상태 확인
    if (!isOnline) {
      return { success: false, error: "네트워크 연결을 확인해주세요." };
    }
    
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    
    // 네트워크 오류인 경우 특별 처리
    if (isNetworkError(authError)) {
      isOnline = false;
      stopFirebaseListener();
      return { success: false, error: "인터넷 연결을 확인해주세요." };
    }
    
    let errorMessage = "비밀번호 재설정 이메일 발송에 실패했습니다.";

    switch (authError.code) {
      case 'auth/user-not-found':
        errorMessage = "등록되지 않은 이메일입니다.";
        break;
      case 'auth/invalid-email':
        errorMessage = "유효하지 않은 이메일 형식입니다.";
        break;
      default:
        errorMessage = authError.message || "알 수 없는 오류가 발생했습니다.";
    }

    return { success: false, error: errorMessage };
  }
};

// 오프라인 인증 관련 유틸리티 함수들
export const isOfflineMode = (): boolean => {
  return !isOnline && getOfflineAuthData() !== null;
};

export const getOfflineUserData = (): OfflineAuthData | null => {
  return getOfflineAuthData();
};

export const clearOfflineAuth = (): void => {
  clearOfflineAuthData();
};
