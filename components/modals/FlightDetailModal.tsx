import React, { useState, useRef } from 'react';
import { Flight } from '../../types';
import { XIcon } from '../icons';
import { parse, subMinutes, format } from 'date-fns';
import { networkDetector } from '../../utils/networkDetector';
import { getCityInfo } from '../../utils/cityData';

interface FlightDetailModalProps {
    flight: Flight | null;
    onClose: () => void;
    onUpdateStatus: (flightId: number, statusToToggle: 'departed' | 'landed') => void;
    flightType?: 'last' | 'next'; // 추가: 비행 타입
    currentUser?: { displayName: string | null } | null; // 현재 사용자 정보 추가
    onCrewClick: (crewName: string) => void;
    onAirportClick: (airportCode: string) => void; // ✨ 공항 코드 클릭 핸들러 추가
}

const FlightDetailModal: React.FC<FlightDetailModalProps> = ({ flight, onClose, onUpdateStatus, flightType, currentUser, onCrewClick, onAirportClick }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    if (!flight) return null;

    const isStandby = flight.flightNumber.includes('STBY');
    const isGroundStudent = flight.flightNumber.includes('G/S STUDENT');
    const standbyTime = flight.flightNumber === 'A STBY' ? '04:00 - 16:00' : '09:00 - 21:00';

    const isSpecialSchedule = isStandby || isGroundStudent;

    // SHOW UP 시간 계산
    let showUpTime = null;
    if (
      !isSpecialSchedule &&
      flight.route?.startsWith('ICN/') &&
      flight.std
    ) {
      try {
        const departureTime = parse(flight.std, 'HH:mm', new Date(flight.date));
        const showUpDateTime = subMinutes(departureTime, 80); // 1시간 20분 빼기
        showUpTime = format(showUpDateTime, 'HH:mm');
      } catch (error) {
        console.error('Show up time calculation error:', error);
        // 파싱 실패 시 showUpTime은 null로 유지
      }
    }

    // 상태 업데이트를 처리하는 함수
    const handleUpdateStatus = async (statusField: 'departed' | 'landed') => {
        if (isUpdating) return; // 이미 업데이트 중이면 중복 실행 방지
        setIsUpdating(true);

        console.log('FlightDetailModal - handleUpdateStatus 호출됨:', {
            flightId: flight.id,
            flightNumber: flight.flightNumber,
            statusField,
            flightData: flight
        });
        
        if (!flight.id) {
            console.error('FlightDetailModal - flight.id가 없음:', flight);
            alert(`오류: 항공편 ID가 없어 업데이트할 수 없습니다.\n항공편 번호: ${flight.flightNumber}\n날짜: ${flight.date}`);
            setIsUpdating(false);
            return;
        }
        
        try {
            console.log('FlightDetailModal - onUpdateStatus 호출:', flight.id, statusField);
            await onUpdateStatus(flight.id, statusField);
        } catch (e) {
            console.error("FlightDetailModal - 업데이트 실패:", e);
            alert('상태 업데이트 중 오류가 발생했습니다.');
        } finally {
            setIsUpdating(false); // 작업 완료 후 버튼 다시 활성화
        }
    };

    const containerClasses = `bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up ${isSpecialSchedule ? 'flex flex-col justify-center min-h-[150px]' : ''}`;

    // 스크롤 이벤트 핸들러
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setShowScrollbar(true);
        
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            setShowScrollbar(false);
        }, 1000);
    };



    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4" onClick={onClose}>
            <div className={containerClasses} onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{flight.flightNumber}{isSpecialSchedule ? '' : '편'} 상세 정보</h2>
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>

                                    <div 
                                        className={`flex-grow overflow-y-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                                        onScroll={handleScroll}
                                    >
                    <div className={`${isSpecialSchedule ? '' : 'mb-6'}`}>
                        <div className="space-y-2 text-base">
                            <div className="flex items-center">
                                <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">DATE</span>
                                <span className="text-gray-800 dark:text-gray-200">
                                    {(() => {
                                        if (flightType === 'next') {
                                            try {
                                                // 출발 도시의 로컬 날짜 계산 (다음 비행인 경우에만)
                                                const departureAirport = flight.route?.split('/')[0];
                                                if (departureAirport && flight.std) {
                                                    const cityInfo = getCityInfo(departureAirport);
                                                    if (cityInfo) {
                                                        // 출발 시간을 기준으로 출발지 현지 날짜 계산
                                                        const departureDate = new Date(flight.date);
                                                        const [stdHour, stdMinute] = flight.std.split(':').map(Number);
                                                        
                                                        // 출발 날짜에 출발 시간을 더해서 출발 시점 계산
                                                        const departureDateTime = new Date(departureDate);
                                                        departureDateTime.setHours(stdHour, stdMinute, 0, 0);
                                                        
                                                        // 출발지 현지 시간으로 변환
                                                        const localDepartureDate = new Date(departureDateTime.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
                                                        
                                                        // 출발지 현지 날짜 반환
                                                        return localDepartureDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('출발지 날짜 계산 오류:', error);
                                            }
                                        }
                                        // 기본 날짜 또는 계산 실패 시 원래 날짜 반환
                                        return new Date(flight.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
                                    })()}
                                </span>
                            </div>
                            
                            {isStandby && (
                                <div className="flex items-center">
                                    <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">시간</span>
                                    <span className="text-gray-800 dark:text-gray-200">{standbyTime}</span>
                                </div>
                            )}

                            {!isSpecialSchedule && (
                                <>
                                    <div className="flex items-center">
                                        <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">ROUTE</span>
                                        <div className="flex items-center space-x-0.5">
                                            {flight.route.split('/').map((airport, index) => (
                                                <React.Fragment key={index}>
                                                    <button
                                                        onClick={() => onAirportClick(airport)}
                                                        className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200 transform hover:scale-105 shadow-sm font-medium"
                                                        title={`${airport} 도시 정보 보기`}
                                                    >
                                                        {airport}
                                                    </button>
                                                    {index === 0 && (
                                                        <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                    {showUpTime && (
                                        <div className="flex items-center">
                                            <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">SHOW UP</span>
                                            <span className="text-gray-800 dark:text-gray-200">{showUpTime}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center">
                                        <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">출도착 시간</span>
                                        <span className="text-gray-800 dark:text-gray-200">{flight.std} → {flight.sta}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {!isSpecialSchedule && (
                        <>
                            <div className="border-t dark:border-gray-700 pt-4">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">FLIGHT CREW LIST</h3>
                                <div className="overflow-x-auto mb-4">
                                    <table className="w-full text-sm text-center">
                                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2">EMPL</th>
                                                <th className="px-4 py-2">NAME</th>
                                                <th className="px-4 py-2">RANK</th>
                                                <th className="px-4 py-2">POSN TYPE</th>
                                                <th className="px-4 py-2">POSN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {flight.crew?.length > 0 ? (
                                                flight.crew.map(member => {
                                                    const isCurrentUser = member.name === currentUser?.displayName;
                                                    return (
                                                        <tr key={member.empl} className={`border-b dark:border-gray-700 ${isCurrentUser ? 'bg-green-100 dark:bg-green-900/50' : ''}`}>
                                                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-200">{member.empl}</td>
                                                            <td
                                                                className={`px-4 py-2 text-gray-900 dark:text-gray-200 ${!isCurrentUser ? 'cursor-pointer hover:underline' : ''}`}
                                                                onClick={() => !isCurrentUser && onCrewClick(member.name)}
                                                                title={!isCurrentUser ? `${member.name}님과의 비행 기록 보기` : ''}
                                                            >
                                                                {member.name}
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{member.rank}</td>
                                                            <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{member.posnType}</td>
                                                            <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{member.posn}</td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                                                        승무원 정보가 없습니다.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {/* 다음 비행이 아니고, 노선 정보가 있는 실제 비행일 경우에만 이착륙 선택 버튼 표시 */}
                            {flightType !== 'next' && flight.route && (
                                <div className="border-t dark:border-gray-700 pt-4">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">이착륙 선택</h3>
                                    <div className="flex space-x-2">
                                        {/* 이륙 버튼: flight.status.departed 값에 따라 동적으로 표시 */}
                                        <button
                                            onClick={() => handleUpdateStatus('departed')}
                                            disabled={isUpdating}
                                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${
                                                flight.status?.departed ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            이륙
                                        </button>

                                        {/* 착륙 버튼: 독립적으로 작동하도록 수정 */}
                                        <button
                                            onClick={() => handleUpdateStatus('landed')}
                                            disabled={isUpdating}
                                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${
                                                flight.status?.landed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            착륙
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FlightDetailModal;