import React from 'react';
import { XIcon } from '../icons';

const APP_VERSION = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_DISPLAY_VERSION) ? import.meta.env.VITE_APP_DISPLAY_VERSION : '1.0.0';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-start z-50 p-4 overflow-y-auto pt-safe" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up my-4 max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="flex-shrink-0 mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">정보</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 text-gray-600 dark:text-gray-300 pr-2">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">My KneeBoard</h3>
                            <p className="text-sm leading-relaxed">
                                항공 승무원을 위한 개인용 비행 관리 도구입니다.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">면책 조항</h3>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                <p className="text-sm leading-relaxed text-yellow-800 dark:text-yellow-200">
                                    이 웹 애플리케이션은 개인이 만든 비공식 프로젝트이며, 
                                    특정 항공사와는 관련이 없습니다. 
                                    모든 정보는 참고용으로만 사용되어야 하며, 
                                    실제 비행 스케줄이나 공식 정보와는 다를 수 있습니다.
                                    <br/><br/>
                                    <strong>중요:</strong> 실제 비행 계획이나 업무에 사용하기 전에 
                                    공식 항공사 정보를 반드시 확인하시기 바랍니다.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">기능</h3>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                                <li>비행 스케줄 관리</li>
                                <li>비행 자격 현황 관리</li>
                                <li>휴식 시간 계산</li>
                                <li>월별 스케줄 조회</li>
                                <li>날씨 정보 및 일출/일몰 시간</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">데이터 출처</h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">항공편 정보:</span>
                                    <p className="text-gray-600 dark:text-gray-400">인천공항 API (실시간 항공편 데이터)</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">대기질(AQI):</span>
                                    <p className="text-gray-600 dark:text-gray-400">AQICN (World Air Quality Index)</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">날씨 정보:</span>
                                    <p className="text-gray-600 dark:text-gray-400">OpenWeatherMap</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">일출/일몰 시간:</span>
                                    <p className="text-gray-600 dark:text-gray-400">sunrise-sunset.org</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">환율 정보:</span>
                                    <p className="text-gray-600 dark:text-gray-400">ExchangeRate.host (또는 배포 환경의 서버리스 엔드포인트)</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">DATIS / NOTAM:</span>
                                    <p className="text-gray-600 dark:text-gray-400">datis.clowd.io (raw) + 자체 디코딩 로직</p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">항공사/도시/공항 정보:</span>
                                    <p className="text-gray-600 dark:text-gray-400">내장 오프라인 DB + 공개 데이터</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">버전</h3>
                            <p className="text-sm">{APP_VERSION}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 flex justify-end mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;
