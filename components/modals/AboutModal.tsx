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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-start z-50 p-4 overflow-y-auto pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up my-4 max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="flex-shrink-0 mb-4">
                    <h2 className="text-2xl font-bold text-white mb-4">정보</h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 text-slate-300 pr-2">
                        <div>
                            <h3 className="font-semibold text-white mb-2">My KneeBoard</h3>
                            <p className="text-sm leading-relaxed">
                                항공 승무원을 위한 개인용 비행 관리 도구입니다.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-2">면책 조항</h3>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                <p className="text-sm leading-relaxed text-yellow-200">
                                    이 웹 애플리케이션은 개인이 만든 비공식 프로젝트이며,
                                    특정 항공사와는 관련이 없습니다.
                                    모든 정보는 참고용으로만 사용되어야 하며,
                                    실제 비행 스케줄이나 공식 정보와는 다를 수 있습니다.
                                    <br /><br />
                                    <strong>중요:</strong> 실제 비행 계획이나 업무에 사용하기 전에
                                    공식 항공사 정보를 반드시 확인하시기 바랍니다.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-2">기능</h3>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                                <li>비행 스케줄 관리 (Excel/PDF 업로드)</li>
                                <li>비행 자격 현황 관리 (Landing Currency)</li>
                                <li>휴식 시간 계산 (2SET/5P/3PILOT)</li>
                                <li>월별 스케줄 조회 및 Block Time 집계</li>
                                <li>CREW 검색 및 도시 검색</li>
                                <li>항공편 스케줄 DB 검색</li>
                                <li>DATIS 정보 조회</li>
                                <li>오프라인 모드 지원</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-2">데이터 출처</h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-medium text-slate-200">항공편 정보:</span>
                                    <p className="text-slate-400">인천공항 API, Firebase DB</p>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-200">스케줄 파싱:</span>
                                    <p className="text-slate-400">대한항공(KE), 아시아나(OZ), 제주항공(7C) 지원</p>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-200">기상 정보:</span>
                                    <p className="text-slate-400">CheckWX METAR/TAF, DATIS</p>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-200">데이터 저장:</span>
                                    <p className="text-slate-400">Firebase Realtime Database</p>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-200">기타 정보:</span>
                                    <p className="text-slate-400">내장 오프라인 DB (공항, 도시, 항공사)</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-2">버전</h3>
                            <p className="text-sm">{APP_VERSION}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 flex justify-end mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 glass-button text-white rounded-xl transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;
