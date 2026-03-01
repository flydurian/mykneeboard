import React, { useState, useEffect } from 'react';
import { validateEmail, sanitizeInput } from '../utils/inputValidation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => void;
  onShowRegister: () => void;
  onKakaoLogin?: () => void;
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
  error?: string;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onShowRegister,
  onKakaoLogin,
  onResetPassword,
  isLoading = false,
  error
}: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setIsResetMode(false);
        setResetMessage('');
        setResetError('');
        setEmail('');
        setPassword('');
      }, 300);
    }
  }, [isOpen]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    if (!validateEmail(sanitizedEmail)) return;
    onLogin(sanitizedEmail, sanitizedPassword);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');
    const result = await onResetPassword(email);
    if (result.success) {
      setResetMessage('비밀번호 재설정 이메일을 보냈습니다. 받은 편지함을 확인해주세요.');
    } else {
      setResetError(result.error || '이메일 발송에 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 pt-safe" onClick={onClose}>
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">{isResetMode ? '비밀번호 찾기' : '로그인'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isResetMode ? (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <p className="text-sm text-slate-300 mb-4">
              가입하신 이메일 주소를 입력하시면, 비밀번호를 재설정할 수 있는 링크를 보내드립니다.
            </p>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1">이메일</label>
              <input
                type="email" id="reset-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                placeholder="이메일을 입력하세요" autoComplete="email"
                style={{ touchAction: 'manipulation', WebkitAppearance: 'none', appearance: 'none', borderRadius: '0.75rem' }}
                required
              />
            </div>
            {resetMessage && (
              <div className="text-emerald-300 text-sm bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-xl">{resetMessage}</div>
            )}
            {resetError && (
              <div className="text-rose-300 text-sm bg-rose-500/20 border border-rose-500/30 p-3 rounded-xl">{resetError}</div>
            )}
            <button type="submit" disabled={isLoading}
              className="w-full glass-button py-2.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ WebkitAppearance: 'none', appearance: 'none', borderRadius: '0.75rem' }}
            >
              재설정 이메일 보내기
            </button>
            <div className="text-center">
              <button type="button" onClick={() => setIsResetMode(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors">
                로그인으로 돌아가기
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">이메일</label>
                <input
                  type="email" id="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                  placeholder="이메일을 입력하세요" autoComplete="email"
                  style={{ touchAction: 'manipulation', WebkitAppearance: 'none', appearance: 'none', borderRadius: '0.75rem' }}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">비밀번호</label>
                <input
                  type="password" id="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                  placeholder="비밀번호를 입력하세요" autoComplete="current-password"
                  style={{ touchAction: 'manipulation', WebkitAppearance: 'none', appearance: 'none', borderRadius: '0.75rem' }}
                  required
                />
              </div>
              <div className="text-right">
                <button type="button" onClick={() => setIsResetMode(true)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              {error && (
                <div className="text-rose-300 text-sm bg-rose-500/20 border border-rose-500/30 p-3 rounded-xl">{error}</div>
              )}
              <button type="submit" disabled={isLoading}
                className="w-full glass-button py-2.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ WebkitAppearance: 'none', appearance: 'none', borderRadius: '0.75rem' }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </div>
                ) : '로그인'}
              </button>
            </form>

            {/* 구분선 */}
            <div className="mt-6 mb-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-600"></div>
              <span className="text-xs text-slate-500">처음이신가요?</span>
              <div className="flex-1 h-px bg-slate-600"></div>
            </div>

            {/* 카카오로 시작하기 버튼 */}
            {onKakaoLogin && (
              <button
                onClick={onKakaoLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-all hover:brightness-105 active:scale-[0.98]"
                style={{ backgroundColor: '#FEE500', color: '#000000', borderRadius: '0.75rem' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9.00002 0.599976C4.02917 0.599976 0 3.71296 0 7.55226C0 9.94002 1.55847 12.0452 3.93152 13.2969L2.93303 16.9452C2.85394 17.2359 3.18903 17.4666 3.44245 17.3011L7.76448 14.4258C8.16829 14.4753 8.58029 14.5045 9.00002 14.5045C13.9706 14.5045 18 11.3916 18 7.55226C18 3.71296 13.9706 0.599976 9.00002 0.599976" fill="#000000" />
                </svg>
                카카오로 시작하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
