import React, { useState } from 'react';
import { XIcon } from './icons';
import { updateUserName, updateUserPassword } from '../src/firebase/auth';

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
    theme: string;
    setTheme: (theme: string) => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, currentUser, theme, setTheme }) => {
    const [activeTab, setActiveTab] = useState<'name' | 'password' | 'theme'>('name');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 이름 변경 관련 상태
    const [newDisplayName, setNewDisplayName] = useState(currentUser?.displayName || '');

    // 비밀번호 변경 관련 상태
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    if (!isOpen) return null;

    const handleNameUpdate = async () => {
        if (!newDisplayName.trim()) {
            setError('이름을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        const result = await updateUserName(newDisplayName.trim());
        
        if (result.success) {
            setSuccess('이름이 성공적으로 변경되었습니다.');
            setTimeout(() => {
                onClose();
            }, 2000);
        } else {
            setError(result.error || '이름 변경에 실패했습니다.');
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">사용자 설정</h2>

                {/* 탭 버튼 */}
                <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('name')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base ${
                            activeTab === 'name' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        이름 변경
                    </button>
                    <button
                        onClick={() => setActiveTab('password')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base ${
                            activeTab === 'password' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <span className="hidden sm:inline">비밀번호 변경</span>
                        <span className="sm:hidden">비밀번호<br />변경</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('theme')}
                        className={`flex-1 py-2 px-2 sm:px-4 font-medium text-sm sm:text-base ${
                            activeTab === 'theme' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        화면 테마
                    </button>
                </div>

                {/* 에러/성공 메시지 */}
                {error && (
                    <div className="mb-4 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* 이름 변경 탭 */}
                {activeTab === 'name' && (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                새 이름
                            </label>
                            <input
                                type="text"
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="새 이름을 입력하세요"
                            />
                        </div>
                        <button
                            onClick={handleNameUpdate}
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? '변경 중...' : '이름 변경'}
                        </button>
                    </div>
                )}

                {/* 비밀번호 변경 탭 */}
                {activeTab === 'password' && (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                현재 비밀번호
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="현재 비밀번호를 입력하세요"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                새 비밀번호
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="새 비밀번호를 입력하세요 (6자 이상)"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                새 비밀번호 확인
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="새 비밀번호를 다시 입력하세요"
                            />
                        </div>
                        <button
                            onClick={handlePasswordUpdate}
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? '변경 중...' : '비밀번호 변경'}
                        </button>
                    </div>
                )}

                {/* 화면 테마 탭 */}
                {activeTab === 'theme' && (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                테마 선택
                            </label>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex-1 py-2 px-4 rounded-lg ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'}`}
                                >
                                    라이트
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex-1 py-2 px-4 rounded-lg ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'}`}
                                >
                                    다크
                                </button>
                                <button
                                    onClick={() => setTheme('system')}
                                    className={`flex-1 py-2 px-4 rounded-lg ${theme === 'system' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'}`}
                                >
                                    시스템
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserSettingsModal;
