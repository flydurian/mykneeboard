import React, { useState, useRef } from 'react';
import { validateEmail, validatePassword, validateDisplayName, sanitizeInput } from '../utils/inputValidation';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (email: string, password: string, displayName: string, company: string, empl?: string) => void;
  isLoading?: boolean;
  error?: string;
}

// 회사 목록
const companies = [
  { value: 'OZ', label: '아시아나항공 (OZ)' },
  { value: 'KE', label: '대한항공 (KE)' },
  { value: '7C', label: '제주항공 (7C)' }
];

export default function RegisterModal({ isOpen, onClose, onRegister, isLoading = false, error }: RegisterModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('OZ'); // 기본값: 아시아나항공
  const [empl, setEmpl] = useState('');
  const [base, setBase] = useState('');
  const [validationError, setValidationError] = useState('');
  
  // 한글 입력을 위한 ref
  const displayNameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // 입력값 정제 (ref에서 값 가져오기)
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    const sanitizedDisplayName = sanitizeInput(displayNameRef.current?.value || displayName);

    // 이메일 검증
    if (!validateEmail(sanitizedEmail)) {
      setValidationError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    // 비밀번호 검증
    const passwordValidation = validatePassword(sanitizedPassword);
    if (!passwordValidation.isValid) {
      setValidationError(passwordValidation.errors[0]);
      return;
    }

    if (sanitizedPassword !== confirmPassword) {
      setValidationError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 사용자 이름 검증
    const nameValidation = validateDisplayName(sanitizedDisplayName);
    if (!nameValidation.isValid) {
      setValidationError(nameValidation.errors[0]);
      return;
    }

    // BASE 유효성 검증 (선택 사항이지만 입력 시 3자 IATA)
    const baseCode = base.trim().toUpperCase();
    if (base && (!/^[A-Z]{3}$/.test(baseCode))) {
      setValidationError('BASE는 IATA 코드(세 글자)로 입력해주세요.');
      return;
    }

    onRegister(sanitizedEmail, sanitizedPassword, sanitizedDisplayName, company, empl);
    // IndexedDB에 회사/베이스 선저장 (회원가입 직후 사용성이 좋도록)
    try {
      import('../utils/indexedDBCache').then(({ indexedDBCache }) => {
        indexedDBCache.saveUserSettings('temp', { company, base: baseCode || undefined });
      }).catch(() => {});
    } catch {}
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setCompany('OZ');
    setEmpl('');
    setBase('');
    setValidationError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 pt-safe" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">회원가입</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              사용자 이름 *
            </label>
            <input
              ref={displayNameRef}
              type="text"
              id="displayName"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="스케줄에 나오는 이름으로 적어주세요"
              onBlur={(e) => setDisplayName(e.target.value)}
              onCompositionStart={(e) => {
                  // 한글 조합 시작 시 React 상태 업데이트 방지
                  e.currentTarget.dataset.composing = 'true';
              }}
              onCompositionEnd={(e) => {
                  // 한글 조합 완료 시 React 상태 업데이트 허용
                  e.currentTarget.dataset.composing = 'false';
                  setDisplayName(e.currentTarget.value);
              }}
              onInput={(e) => {
                  // 조합 중이 아닐 때만 상태 업데이트
                  if (e.currentTarget.dataset.composing !== 'true') {
                      setDisplayName(e.currentTarget.value);
                  }
              }}
              required
            />
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              소속 회사 *
            </label>
            <select
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {companies.map((comp) => (
                <option key={comp.value} value={comp.value}>
                  {comp.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="base" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              BASE (IATA 코드)
            </label>
            <input
              type="text"
              id="base"
              value={base}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,3);
                setBase(v);
              }}
              maxLength={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              placeholder="IATA code로 입력해주세요 (예: ICN)"
            />
          </div>

          <div>
            <label htmlFor="empl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              EMPL *
            </label>
            <input
              type="text"
              id="empl"
              value={empl}
              onChange={(e) => setEmpl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="EMPL을 입력하세요"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              이메일 *
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="이메일을 입력하세요"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              비밀번호 *
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="6자 이상의 비밀번호를 입력하세요"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              비밀번호 확인 *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
          </div>

          {(validationError || error) && (
            <div className="text-red-600 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900 p-3 rounded-md">
              {validationError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                회원가입 중...
              </div>
            ) : (
              '회원가입'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            이미 계정이 있으신가요?{' '}
            <button 
              onClick={handleClose}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500 font-medium"
            >
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
