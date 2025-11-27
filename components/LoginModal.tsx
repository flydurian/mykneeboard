import React, { useState, useEffect } from 'react';
import { validateEmail, sanitizeInput } from '../utils/inputValidation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => void;
  onShowRegister: () => void;
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
  error?: string;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onShowRegister,
  onResetPassword,
  isLoading = false,
  error
}: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setIsResetMode(false);
        setResetMessage('');
        setResetError('');
        setEmail('');
        setPassword('');
      }, 300); // 애니메이션 시간 고려
    }
  }, [isOpen]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 입력값 정제 및 검증
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);

    if (!validateEmail(sanitizedEmail)) {
      return; // 이메일 형식이 잘못된 경우 로그인 시도하지 않음
    }

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
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
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
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1">
                이메일
              </label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                placeholder="이메일을 입력하세요"
                autoComplete="email"
                style={{ touchAction: 'manipulation' }}
                required
              />
            </div>

            {resetMessage && (
              <div className="text-emerald-300 text-sm bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-xl">
                {resetMessage}
              </div>
            )}
            {resetError && (
              <div className="text-rose-300 text-sm bg-rose-500/20 border border-rose-500/30 p-3 rounded-xl">
                {resetError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full glass-button py-2.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              재설정 이메일 보내기
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsResetMode(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                로그인으로 돌아가기
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                  placeholder="이메일을 입력하세요"
                  autoComplete="email"
                  style={{ touchAction: 'manipulation' }}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl focus:outline-none"
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  style={{ touchAction: 'manipulation' }}
                  required
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>

              {error && (
                <div className="text-rose-300 text-sm bg-rose-500/20 border border-rose-500/30 p-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full glass-button py-2.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </div>
                ) : (
                  '로그인'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-400">
                계정이 없으신가요?{' '}
                <button
                  onClick={onShowRegister}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  회원가입
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
