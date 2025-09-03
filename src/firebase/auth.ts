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
  reauthenticateWithCredential
} from "firebase/auth";
import { auth } from "./config";

// 로그인 함수
export const loginUser = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
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
      case 'auth/too-many-requests':
        errorMessage = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
        break;
      default:
        errorMessage = authError.message || "로그인에 실패했습니다.";
    }
    
    return { success: false, error: errorMessage };
  }
};

// 회원가입 함수
export const registerUser = async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 사용자 프로필 업데이트 (사용자 이름 설정)
    await updateProfile(user, {
      displayName: displayName
    });
    
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
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

// 로그아웃 함수
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return { success: false, error: authError.message || "로그아웃에 실패했습니다." };
  }
};

// 인증 상태 변경 감지
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// 현재 사용자 가져오기
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
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
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
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
