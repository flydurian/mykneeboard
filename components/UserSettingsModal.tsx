import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from './icons';
import { updateUserName, updateUserPassword, getUserInfo } from '../src/firebase/auth';
import { saveUserSettings } from '../src/firebase/database';

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
    selectedAirline?: string;
    setSelectedAirline?: (airline: string) => void;
    userInfo?: { displayName: string | null; empl?: string; userName?: string; company?: string } | null;
    onSettingsUpdate?: (userId: string, settings: any) => Promise<void>;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, currentUser, selectedAirline = 'OZ', setSelectedAirline, userInfo, onSettingsUpdate }) => {
    const [activeTab, setActiveTab] = useState<'name' | 'password' | 'theme' | 'airline' | 'base'>('airline');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 이름 변경 관련 상태
    const [newDisplayName, setNewDisplayName] = useState(currentUser?.displayName || '');
    const [newEmplId, setNewEmplId] = useState(currentUser?.emplId || '');

    // 비밀번호 변경 관련 상태
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // 항공사 선택 관련 상태
    const [tempSelectedAirline, setTempSelectedAirline] = useState(selectedAirline);

    // 한글 입력을 위한 ref
    const nameInputRef = useRef<HTMLInputElement>(null);


    // 모달이 열릴 때 Firebase에서 사용자 정보를 직접 가져와서 자동 채우기
    useEffect(() => {
        if (isOpen && currentUser?.uid) {
            const loadUserInfo = async () => {
                try {
                    // Firebase에서 직접 사용자 정보 가져오기 (항상 최신 데이터)
                    const userInfoData = await getUserInfo(currentUser.uid);

                    if (userInfoData) {
                        // EMPL ID가 있으면 자동으로 채우기
                        if (userInfoData.empl) {
                            setNewEmplId(userInfoData.empl);
                        }

                        // 이름이 있으면 자동으로 채우기 (settings의 userName 우선, 없으면 displayName 사용)
                        if (userInfoData.userName) {
                            setNewDisplayName(userInfoData.userName);
                        } else if (userInfoData.displayName) {
                            setNewDisplayName(userInfoData.displayName);
                        }

                        // 회사 정보가 있으면 자동으로 설정
                        if (userInfoData.company) {
                            setTempSelectedAirline(userInfoData.company);
                        }
                    }
                } catch (error) {
                    console.error('❌ Firebase 사용자 정보 로드 오류:', error);
                }
            };
            loadUserInfo();
        }
    }, [isOpen, currentUser?.uid]);

    // newDisplayName이 변경될 때마다 DOM에 직접 설정 (한글 자모 분리 방지)
    useEffect(() => {
        if (newDisplayName && nameInputRef.current) {
            // 강제로 DOM 값 설정
            const input = nameInputRef.current;
            const currentValue = input.value;

            if (currentValue !== newDisplayName) {
                input.value = newDisplayName;

                // 모든 이벤트 발생시켜서 React와 브라우저 동기화
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }
    }, [newDisplayName]);


    if (!isOpen) return null;

    const handleNameUpdate = async () => {
        if (!newDisplayName.trim()) {
            setError('이름을 입력해주세요.');
            return;
        }

        if (!newEmplId.trim()) {
            setError('EMPL ID를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            // 이름과 EMPL ID를 함께 업데이트
            const result = await updateUserName(newDisplayName.trim());

            if (result.success) {
                // EMPL ID와 사용자 이름을 Firebase에 즉시 저장
                if (currentUser?.uid) {
                    await saveUserSettings(currentUser.uid, {
                        empl: newEmplId.trim(),
                        userName: newDisplayName.trim()
                    });

                    // 콜백을 통해 App.tsx의 상태도 즉시 업데이트
                    if (onSettingsUpdate) {
                        await onSettingsUpdate(currentUser.uid, {
                            empl: newEmplId.trim(),
                            userName: newDisplayName.trim()
                        });
                    }
                }

                setSuccess('이름과 EMPL ID가 성공적으로 변경되었습니다.');
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setError(result.error || '이름 변경에 실패했습니다.');
            }
        } catch (error) {
            console.error('이름/EMPL ID 업데이트 오류:', error);
            setError('정보 변경 중 오류가 발생했습니다.');
        }

        setIsLoading(false);
    };

    const handlePasswordUpdate = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('모든 필드를 입력해주세요.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (newPassword.length < 6) {
            setError('새 비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        const result = await updateUserPassword(currentPassword, newPassword);

        if (result.success) {
            setSuccess('비밀번호가 성공적으로 변경되었습니다.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                onClose();
            }, 2000);
        } else {
            setError(result.error || '비밀번호 변경에 실패했습니다.');
        }

        setIsLoading(false);
    };

    const handleAirlineUpdate = async () => {
        if (!currentUser?.uid) {
            setError('로그인이 필요합니다.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Firebase에 항공사 설정 즉시 저장
            const success = await saveUserSettings(currentUser.uid, { airline: tempSelectedAirline });

            if (success) {

                // 콜백을 통해 App.tsx의 상태도 즉시 업데이트
                if (onSettingsUpdate) {
                    await onSettingsUpdate(currentUser.uid, { airline: tempSelectedAirline });
                }

                // 로컬 상태 업데이트
                if (setSelectedAirline) {
                    setSelectedAirline(tempSelectedAirline);
                }
                setSuccess('항공사가 성공적으로 변경되었습니다.');
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setError('항공사 설정 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('항공사 설정 저장 오류:', error);
            setError('항공사 설정 저장 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel w-full max-w-md p-6 relative animate-fade-in-up rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">사용자 설정</h2>

                {/* 탭 버튼 */}
                <div className="flex mb-6 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('airline')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base transition-colors ${activeTab === 'airline'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-white/50 hover:text-white/90'
                            }`}
                    >
                        회사
                    </button>
                    <button
                        onClick={() => setActiveTab('base')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base transition-colors ${activeTab === 'base'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-white/50 hover:text-white/90'
                            }`}
                    >
                        BASE
                    </button>
                    <button
                        onClick={() => setActiveTab('name')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base transition-colors ${activeTab === 'name'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-white/50 hover:text-white/90'
                            }`}
                    >
                        이름
                    </button>
                    <button
                        onClick={() => setActiveTab('password')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base transition-colors ${activeTab === 'password'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-white/50 hover:text-white/90'
                            }`}
                    >
                        <span className="hidden sm:inline">비밀번호</span>
                        <span className="sm:hidden">비밀번호</span>
                    </button>
                </div>

                {/* 에러/성공 메시지 */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 text-green-200 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* 이름 변경 탭 */}
                {activeTab === 'name' && (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                새 이름
                            </label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    borderRadius: '0.5rem',
                                    textTransform: 'uppercase'
                                }}
                                placeholder="스케줄에 나오는 이름으로 입력하세요"
                                onBlur={(e) => setNewDisplayName(e.target.value.toUpperCase())}
                                onCompositionStart={(e) => {
                                    // 한글 조합 시작 시 React 상태 업데이트 방지
                                    e.currentTarget.dataset.composing = 'true';
                                }}
                                onCompositionEnd={(e) => {
                                    // 한글 조합 완료 시 React 상태 업데이트 허용
                                    e.currentTarget.dataset.composing = 'false';
                                    setNewDisplayName(e.currentTarget.value.toUpperCase());
                                }}
                                onInput={(e) => {
                                    // 조합 중이 아닐 때만 상태 업데이트
                                    if (e.currentTarget.dataset.composing !== 'true') {
                                        setNewDisplayName(e.currentTarget.value.toUpperCase());
                                    }
                                }}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                EMPL ID
                            </label>
                            <input
                                type="text"
                                value={newEmplId}
                                onChange={(e) => setNewEmplId(e.target.value.toUpperCase())}
                                className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    borderRadius: '0.5rem',
                                    textTransform: 'uppercase'
                                }}
                                placeholder="EMPL ID를 입력하세요"
                            />
                        </div>
                        <button
                            onClick={handleNameUpdate}
                            disabled={isLoading}
                            className="w-full glass-button text-white font-bold py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
                            style={{
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                borderRadius: '0.75rem'
                            }}
                        >
                            {isLoading ? '변경 중...' : '정보 변경'}
                        </button>
                    </div>
                )}

                {/* 비밀번호 변경 탭 */}
                {activeTab === 'password' && (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                현재 비밀번호
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    borderRadius: '0.5rem'
                                }}
                                placeholder="현재 비밀번호를 입력하세요"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                새 비밀번호
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    borderRadius: '0.5rem'
                                }}
                                placeholder="새 비밀번호를 입력하세요 (6자 이상)"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                새 비밀번호 확인
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    borderRadius: '0.5rem'
                                }}
                                placeholder="새 비밀번호를 다시 입력하세요"
                            />
                        </div>
                        <button
                            onClick={handlePasswordUpdate}
                            disabled={isLoading}
                            className="w-full glass-button text-white font-bold py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
                            style={{
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                borderRadius: '0.75rem'
                            }}
                        >
                            {isLoading ? '변경 중...' : '비밀번호 변경'}
                        </button>
                    </div>
                )}



                {/* 회사 탭 */}
                {activeTab === 'airline' && (
                    <div>
                        <div className="flex justify-center mb-4">
                            <div className="w-24 bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
                                <div className="relative h-48">
                                    {['OZ', 'KE', '7C'].map((airline, index) => (
                                        <div
                                            key={airline}
                                            onClick={() => setTempSelectedAirline(airline)}
                                            className={`h-16 flex items-center justify-center cursor-pointer transition-all duration-200 ${tempSelectedAirline === airline
                                                ? 'bg-indigo-600/50 text-white font-bold shadow-lg'
                                                : 'text-white/50 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <span className="text-lg font-bold tracking-wider">
                                                {airline}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleAirlineUpdate}
                            disabled={isLoading}
                            className="w-full glass-button text-white font-bold py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
                            style={{
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                borderRadius: '0.75rem'
                            }}
                        >
                            {isLoading ? '적용 중...' : '확인'}
                        </button>
                    </div>
                )}

                {/* BASE 탭 */}
                {activeTab === 'base' && (
                    <BaseSettings currentUser={currentUser} onSettingsUpdate={onSettingsUpdate} />
                )}
            </div>
        </div>
    );
};

export default UserSettingsModal;

// BASE 설정 서브컴포넌트
const BaseSettings: React.FC<{ currentUser: any; onSettingsUpdate?: (userId: string, settings: any) => Promise<void> }>
    = ({ currentUser, onSettingsUpdate }) => {
        const [base, setBase] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [message, setMessage] = useState('');

        useEffect(() => {
            const load = async () => {
                try {
                    if (!currentUser?.uid) return;
                    const { getUserSettings } = await import('../src/firebase/database');
                    const settings = await getUserSettings(currentUser.uid);
                    if (settings?.base) {
                        setBase(String(settings.base).toUpperCase());
                    }
                    try {
                        const { indexedDBCache } = await import('../utils/indexedDBCache');
                        const local = await indexedDBCache.loadUserSettings(currentUser.uid);
                        if (!settings?.base && local?.base) {
                            setBase(String(local.base).toUpperCase());
                        }
                    } catch { }
                } catch { }
            };
            load();
        }, [currentUser?.uid]);

        const handleSave = async () => {
            const code = base.trim().toUpperCase();
            if (code && !/^[A-Z]{3}$/.test(code)) {
                setMessage('BASE는 IATA 코드(세 글자)로 입력해주세요.');
                return;
            }
            setIsLoading(true);
            setMessage('');
            try {
                if (currentUser?.uid) {
                    await saveUserSettings(currentUser.uid, { base: code });
                    try {
                        const { indexedDBCache } = await import('../utils/indexedDBCache');
                        await indexedDBCache.saveUserSettings(currentUser.uid, { base: code });
                    } catch { }
                    if (onSettingsUpdate) {
                        await onSettingsUpdate(currentUser.uid, { base: code });
                    }
                    setMessage('저장되었습니다.');
                }
            } catch (e) {
                setMessage('저장에 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    BASE (IATA 코드)
                </label>
                <input
                    type="text"
                    value={base}
                    onChange={(e) => setBase(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
                    maxLength={3}
                    className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        borderRadius: '0.5rem'
                    }}
                    placeholder="IATA code로 입력해주세요 (예: ICN)"
                />
                {message && (
                    <div className="mt-2 text-sm text-gray-300">{message}</div>
                )}
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="mt-4 w-full glass-button text-white font-bold py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
                    style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        borderRadius: '0.75rem'
                    }}
                >
                    {isLoading ? '저장 중...' : '저장'}
                </button>
            </div>
        );
    };
