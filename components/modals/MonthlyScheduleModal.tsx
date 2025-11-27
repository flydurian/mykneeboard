import React, { useState, useRef, useEffect } from 'react';
import { MonthlyModalData, Flight } from '../../types';
import { XIcon } from '../icons';
import { isActualFlight } from '../../utils/helpers';
import { formatInTimeZone } from 'date-fns-tz';

interface MonthlyScheduleModalProps {
    data: MonthlyModalData | null;
    onClose: () => void;
    onFlightClick: (flight: Flight) => void;
    onMonthChange: (month: number) => void;
    onStatusChange?: (flightId: string, status: Partial<{ departed: boolean; landed: boolean }>) => void;
    userInfo?: { displayName: string | null; empl?: string; userName?: string; company?: string } | null;
}

// 공항별 타임존 매핑
const getAirportTimeZone = (airportCode: string): string => {
    const timezoneMap: { [key: string]: string } = {
        'ICN': 'Asia/Seoul',
        'FCO': 'Europe/Rome',
        'TPE': 'Asia/Taipei',
        'JFK': 'America/New_York',
        'SFO': 'America/Los_Angeles',
        'LAX': 'America/Los_Angeles',
        'NRT': 'Asia/Tokyo',
        'HND': 'Asia/Tokyo',
        'LHR': 'Europe/London',
        'CDG': 'Europe/Paris',
        'FRA': 'Europe/Berlin',
        'SIN': 'Asia/Singapore',
        'HKG': 'Asia/Hong_Kong',
        'BKK': 'Asia/Bangkok',
        'KUL': 'Asia/Kuala_Lumpur',
        'MNL': 'Asia/Manila',
        'HNL': 'Pacific/Honolulu',
        'YVR': 'America/Vancouver',
        'YYZ': 'America/Toronto',
        'SYD': 'Australia/Sydney',
        'MEL': 'Australia/Melbourne',
        'AKL': 'Pacific/Auckland'
    };
    return timezoneMap[airportCode] || 'Asia/Seoul'; // 기본값은 서울
};

const MonthlyScheduleModal: React.FC<MonthlyScheduleModalProps> = ({ data, onClose, onFlightClick, onMonthChange, onStatusChange, userInfo }) => {
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [localFlights, setLocalFlights] = useState<Flight[]>([]);

    // data가 변경될 때마다 localFlights 업데이트
    useEffect(() => {
        if (data && data.flights) {
            setLocalFlights(data.flights);
        }
    }, [data]);

    if (!data) {
        return null;
    }

    const { month, flights, blockTime } = data;
    const flightsToUse = localFlights.length > 0 ? localFlights : flights;

    // 중복 제거: 같은 ID를 가진 비행 데이터 중복 제거
    const uniqueFlights = flightsToUse.reduce((acc, current) => {
        const existingIndex = acc.findIndex(flight => flight.id === current.id);
        if (existingIndex === -1) {
            acc.push(current);
        }
        return acc;
    }, [] as Flight[]);


    // 시간 순 정렬: 날짜와 STD 시간 기준으로 정렬
    const sortedFlights = uniqueFlights.sort((a, b) => {
        // 날짜 비교
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }

        // 같은 날짜인 경우 STD 시간으로 정렬
        const stdA = a.std || '00:00';
        const stdB = b.std || '00:00';

        // 시간 형식 변환 (HHMM -> HH:MM)
        const formatTime = (time: string) => {
            if (time.includes(':')) return time;
            if (time.length === 4) {
                return `${time.substring(0, 2)}:${time.substring(2, 4)}`;
            }
            return time;
        };

        const formattedStdA = formatTime(stdA);
        const formattedStdB = formatTime(stdB);

        return formattedStdA.localeCompare(formattedStdB);
    });

    // 현재 날짜를 기준으로 '이번 달' 또는 '지난 달'인지 확인하는 로직 추가
    const today = new Date();
    const currentDisplayYear = sortedFlights.length > 0 ? new Date(sortedFlights[0].date).getFullYear() : 0;
    const isCurrentMonthSchedule = today.getFullYear() === currentDisplayYear && today.getMonth() === month;
    const isPastMonthSchedule = today.getFullYear() === currentDisplayYear && today.getMonth() > month;
    const shouldShowTakeoffLandingButtons = isCurrentMonthSchedule || isPastMonthSchedule;

    // 오늘 날짜인지 확인하는 함수 (기기 현지 시간대 기준 문자열 비교)
    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const todayLocalStr = formatInTimeZone(new Date(), deviceTimeZone, 'yyyy-MM-dd');
    const isToday = (flightDate: string) => {
        // flightDate는 출발지 현지 날짜 문자열(YYYY-MM-DD)
        // 기기 현지 날짜 문자열과 동일하면 오늘로 간주하여 파란 막대 표시
        return flightDate === todayLocalStr;
    };

    // KE 스케줄인지 확인 (A/C TYPE 정보가 있는 비행편이 있는지 체크)
    const isKESchedule = sortedFlights.some(flight => flight.acType);

    const handleFlightClick = (flight: Flight) => {
        onFlightClick(flight);
    };

    const handlePreviousMonth = () => {
        const newMonth = month === 0 ? 11 : month - 1;
        onMonthChange(newMonth);
    };

    const handleNextMonth = () => {
        const newMonth = month === 11 ? 0 : month + 1;
        onMonthChange(newMonth);
    };

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

    // 업로드 변경 날짜 리스트 불러오기 (내용 기반 비교 결과)
    let changedDatesPayload: { at: string, dates: string[] } | null = null;
    try {
        const raw = localStorage.getItem('last_upload_changed_dates');
        if (raw) changedDatesPayload = JSON.parse(raw);
    } catch { }
    const changedDatesSet = new Set<string>(changedDatesPayload?.dates || []);

    // 특정 날짜 그룹이 변경된 날짜인지 판단
    const hasRecentChange = (flightsForDate: Flight[]) => {
        if (changedDatesSet.size === 0) return false;
        const dateKey = flightsForDate[0]?.date;
        if (!dateKey) return false;
        return changedDatesSet.has(dateKey);
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50"
                style={{
                    paddingTop: 'max(1rem, env(safe-area-inset-top))',
                    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right))'
                }}
                onClick={onClose}
            >
                <div className="glass-panel rounded-2xl shadow-xl w-full max-w-lg md:max-w-4xl lg:max-w-5xl xl:max-w-6xl p-4 md:p-6 relative animate-fade-in-up flex flex-col max-h-full" onClick={(e) => e.stopPropagation()}>
                    {/* 헤더 영역 */}
                    <div className="flex items-center justify-between mb-4">
                        {/* 제목 */}
                        <h2 className="text-xl font-bold text-white">
                            {month + 1}월 스케줄
                            <span className="text-base font-medium text-slate-400 ml-2">
                                (총 {blockTime})
                            </span>
                        </h2>

                        {/* 네비게이션 및 닫기 버튼들 */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={handlePreviousMonth}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="이전 월"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="다음 월"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="닫기"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div
                        className={`flex-grow overflow-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                        onScroll={handleScroll}
                    >
                        {flights.length > 0 ? (
                            <table className={`text-center w-full ${isKESchedule ? 'text-xs md:text-sm lg:text-base' : 'text-sm md:text-base'}`}>
                                <thead className="text-xs font-semibold text-slate-300 uppercase bg-white/5 sticky top-0 z-10">
                                    <tr>
                                        <th className={`${isKESchedule ? 'px-2 py-1 md:px-3 md:py-2 lg:px-4' : 'px-4 py-2'} whitespace-nowrap`}>날짜</th>
                                        <th className={`${isKESchedule ? 'px-2 py-1 md:px-3 md:py-2 lg:px-4' : 'px-4 py-2'} whitespace-nowrap`}>편명</th>
                                        <th className={`${isKESchedule ? 'px-2 py-1 md:px-3 md:py-2 lg:px-4' : 'px-4 py-2'} whitespace-nowrap`}>노선</th>
                                        {/* KE 스케줄에만 A/C TYPE 컬럼 표시 */}
                                        {isKESchedule && (
                                            <th className="px-2 py-1 md:px-3 md:py-2 lg:px-4">
                                                <div className="text-xs md:text-sm">
                                                    <div>A/C</div>
                                                    <div>TYPE</div>
                                                </div>
                                            </th>
                                        )}
                                        {/* md(768px) 이상 화면에서만 보이도록 수정 */}
                                        <th className="px-4 py-2 md:px-3 md:py-2 lg:px-4 whitespace-nowrap hidden md:table-cell">SHOW UP</th>
                                        <th className="px-4 py-2 md:px-3 md:py-2 lg:px-4 whitespace-nowrap hidden md:table-cell">STD</th>
                                        <th className="px-4 py-2 md:px-3 md:py-2 lg:px-4 whitespace-nowrap hidden md:table-cell">STA</th>
                                        {shouldShowTakeoffLandingButtons && (
                                            <th className="px-4 py-2 md:px-3 md:py-2 lg:px-4 whitespace-nowrap hidden md:table-cell">이착륙</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // 같은 날짜별로 그룹화하여 rowspan 계산
                                        const groupedFlights: { [date: string]: Flight[] } = {};
                                        sortedFlights.forEach(flight => {
                                            if (!groupedFlights[flight.date]) {
                                                groupedFlights[flight.date] = [];
                                            }
                                            groupedFlights[flight.date].push(flight);
                                        });

                                        const rows: React.ReactElement[] = [];
                                        Object.keys(groupedFlights).forEach(date => {
                                            const flightsForDate = groupedFlights[date];
                                            const showGreenBar = hasRecentChange(flightsForDate);
                                            flightsForDate.forEach((flight, flightIndex) => {
                                                const isFirstFlight = flightIndex === 0;
                                                const rowspan = isFirstFlight ? flightsForDate.length : undefined;

                                                rows.push(
                                                    <tr
                                                        key={`${flight.id}-${date}-${flightIndex}`}
                                                        className={`border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${isToday(flight.date)
                                                            ? 'relative'
                                                            : ''
                                                            }`}
                                                        onClick={() => handleFlightClick(flight)}
                                                    >
                                                        {isFirstFlight && (
                                                            <td
                                                                rowSpan={rowspan}
                                                                className={`${isKESchedule ? 'px-2 py-2 md:px-3 md:py-3 lg:px-4' : 'px-4 py-3'} font-medium text-white whitespace-nowrap relative ${
                                                                    // 기본 선은 초록색(변경) 선으로 두고
                                                                    showGreenBar ? 'border-l-4 border-green-500' : 'border-l-4 border-transparent'
                                                                    }`}
                                                            >
                                                                {/* 오늘(마젠타 막대)은 같은 세로선 위에 오도록 absolute로 덮어쓰기 */}
                                                                {isToday(flight.date) && (
                                                                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${showGreenBar ? 'bg-fuchsia-500' : 'bg-fuchsia-500'}`} aria-hidden />
                                                                )}
                                                                {flight.date.substring(5)}
                                                            </td>
                                                        )}
                                                        <td className={`${isKESchedule ? 'px-2 py-2 md:px-3 md:py-3 lg:px-4' : 'px-4 py-3'} text-white max-w-[100px] break-words`}>
                                                            {flight.flightNumber}
                                                        </td>
                                                        <td className={`${isKESchedule ? 'px-2 py-2 md:px-3 md:py-3 lg:px-4' : 'px-4 py-3'} text-white max-w-[120px] break-words ${isToday(flight.date) && !isKESchedule && !shouldShowTakeoffLandingButtons
                                                            ? 'border-r-4 border-fuchsia-500'
                                                            : ''
                                                            }`}>
                                                            {isActualFlight(flight)
                                                                ? flight.route?.replace('/', ' → ')
                                                                : (flight.flightNumber === 'OTHRDUTY' || flight.flightNumber === 'HM SBY' || flight.flightNumber === 'STBY' ? flight.route :
                                                                    flight.flightNumber === 'RESERVE' || flight.flightNumber === 'ALV' || flight.flightNumber === 'ALM' ? '' : '')
                                                            }
                                                        </td>
                                                        {/* KE 스케줄에만 A/C TYPE 컬럼 표시 */}
                                                        {isKESchedule && (
                                                            <td className={`px-2 py-2 md:px-3 md:py-3 lg:px-4 text-white text-center ${isToday(flight.date) && !shouldShowTakeoffLandingButtons
                                                                ? 'border-r-4 border-fuchsia-500'
                                                                : ''
                                                                }`}>
                                                                {flight.acType || ''}
                                                            </td>
                                                        )}
                                                        {/* SHOW UP 시간 (데이터베이스에서 가져온 값 사용) */}
                                                        <td className="px-4 py-3 md:px-3 md:py-3 lg:px-4 text-white whitespace-nowrap hidden md:table-cell">
                                                            {/* G/S STUDENT, STBY, FIXED SKD 스케줄은 SHOW UP 표시하지 않음 */}
                                                            {flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                                                                flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                                                                flight.flightNumber.toUpperCase().includes('STBY') ||
                                                                flight.flightNumber.toUpperCase().includes('RESERVE') ||
                                                                flight.flightNumber.toUpperCase().includes('FIXED SKD') ? '' : (
                                                                flight.showUpDateTimeUtc ? (
                                                                    formatInTimeZone(new Date(flight.showUpDateTimeUtc), 'Asia/Seoul', 'HH:mm')
                                                                ) : ''
                                                            )}
                                                        </td>
                                                        {/* md(768px) 이상 화면에서만 보이도록 수정 */}
                                                        <td className="px-4 py-3 md:px-3 md:py-3 lg:px-4 text-white whitespace-nowrap hidden md:table-cell">
                                                            {/* 특별 스케줄은 STD/STA 표시하지 않음 (단, A STBY/B STBY는 제외) */}
                                                            {flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                                                                flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                                                                (flight.flightNumber.toUpperCase().includes('STBY') &&
                                                                    !flight.flightNumber.includes('A STBY') &&
                                                                    !flight.flightNumber.includes('B STBY')) ||
                                                                flight.flightNumber.toUpperCase().includes('RESERVE') ||
                                                                flight.flightNumber.toUpperCase().includes('FIXED SKD') ||
                                                                flight.flightNumber.toUpperCase().includes('ANNUAL LEAVE') ||
                                                                flight.flightNumber.toUpperCase().includes('ALV') ||
                                                                flight.flightNumber.toUpperCase().includes('ALM') ||
                                                                flight.flightNumber.toUpperCase().includes('MEDICAL CHK') ||
                                                                flight.flightNumber.toUpperCase().includes('MEDICAL') ||
                                                                flight.flightNumber.toUpperCase().includes('ORAL') ||
                                                                flight.flightNumber.toUpperCase().includes('안전회의') ||
                                                                flight.flightNumber.toUpperCase().includes('SAFETY') ? (
                                                                // A STBY/B STBY는 특별 시간 표시
                                                                flight.flightNumber === 'A STBY' ? '04:00' :
                                                                    flight.flightNumber === 'B STBY' ? '09:00' : ''
                                                            ) : (
                                                                // A STBY/B STBY는 OZ 스케줄이면 하드코딩된 시간, 다른 스케줄은 실제 시간 사용
                                                                flight.flightNumber === 'A STBY' || flight.flightNumber === 'B STBY' ? (
                                                                    userInfo?.company === 'OZ' ? (
                                                                        flight.flightNumber === 'A STBY' ? '04:00' : '09:00'
                                                                    ) : (
                                                                        flight.departureDateTimeUtc ? (
                                                                            (() => {
                                                                                const depUtc = new Date(flight.departureDateTimeUtc);
                                                                                return formatInTimeZone(depUtc, 'Asia/Seoul', 'HH:mm');
                                                                            })()
                                                                        ) : (
                                                                            flight.flightNumber === 'A STBY' ? '04:00' : '09:00'
                                                                        )
                                                                    )
                                                                ) : (
                                                                    flight.departureDateTimeUtc && flight.route ? (
                                                                        (() => {
                                                                            const depUtc = new Date(flight.departureDateTimeUtc);
                                                                            const departureAirport = flight.route.split('/')[0];
                                                                            const departureTimezone = getAirportTimeZone(departureAirport);
                                                                            return formatInTimeZone(depUtc, departureTimezone, 'HH:mm');
                                                                        })()
                                                                    ) : ''
                                                                )
                                                            )}
                                                        </td>
                                                        <td className={`px-4 py-3 md:px-3 md:py-3 lg:px-4 text-white whitespace-nowrap hidden md:table-cell ${isToday(flight.date) && !shouldShowTakeoffLandingButtons
                                                            ? 'border-r-4 border-fuchsia-500'
                                                            : ''
                                                            }`}>
                                                            {/* 특별 스케줄은 STD/STA 표시하지 않음 (단, A STBY/B STBY는 제외) */}
                                                            {flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                                                                flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                                                                (flight.flightNumber.toUpperCase().includes('STBY') &&
                                                                    !flight.flightNumber.includes('A STBY') &&
                                                                    !flight.flightNumber.includes('B STBY')) ||
                                                                flight.flightNumber.toUpperCase().includes('RESERVE') ||
                                                                flight.flightNumber.toUpperCase().includes('FIXED SKD') ||
                                                                flight.flightNumber.toUpperCase().includes('ANNUAL LEAVE') ||
                                                                flight.flightNumber.toUpperCase().includes('ALV') ||
                                                                flight.flightNumber.toUpperCase().includes('ALM') ||
                                                                flight.flightNumber.toUpperCase().includes('MEDICAL CHK') ||
                                                                flight.flightNumber.toUpperCase().includes('MEDICAL') ||
                                                                flight.flightNumber.toUpperCase().includes('ORAL') ||
                                                                flight.flightNumber.toUpperCase().includes('안전회의') ||
                                                                flight.flightNumber.toUpperCase().includes('SAFETY') ? (
                                                                // A STBY/B STBY는 특별 시간 표시
                                                                flight.flightNumber === 'A STBY' ? '16:00' :
                                                                    flight.flightNumber === 'B STBY' ? '21:00' : ''
                                                            ) : (
                                                                // A STBY/B STBY는 OZ 스케줄이면 하드코딩된 시간, 다른 스케줄은 실제 시간 사용
                                                                flight.flightNumber === 'A STBY' || flight.flightNumber === 'B STBY' ? (
                                                                    userInfo?.company === 'OZ' ? (
                                                                        flight.flightNumber === 'A STBY' ? '16:00' : '21:00'
                                                                    ) : (
                                                                        flight.arrivalDateTimeUtc ? (
                                                                            (() => {
                                                                                const arrUtc = new Date(flight.arrivalDateTimeUtc);
                                                                                return formatInTimeZone(arrUtc, 'Asia/Seoul', 'HH:mm');
                                                                            })()
                                                                        ) : (
                                                                            flight.flightNumber === 'A STBY' ? '16:00' : '21:00'
                                                                        )
                                                                    )
                                                                ) : (
                                                                    flight.arrivalDateTimeUtc && flight.route ? (
                                                                        (() => {
                                                                            const arrUtc = new Date(flight.arrivalDateTimeUtc);
                                                                            const arrivalAirport = flight.route.split('/')[1];
                                                                            const arrivalTimezone = getAirportTimeZone(arrivalAirport);
                                                                            return formatInTimeZone(arrUtc, arrivalTimezone, 'HH:mm');
                                                                        })()
                                                                    ) : ''
                                                                )
                                                            )}
                                                        </td>
                                                        {shouldShowTakeoffLandingButtons && (
                                                            <td className={`px-4 py-3 md:px-3 md:py-3 lg:px-4 whitespace-nowrap hidden md:table-cell ${isToday(flight.date)
                                                                ? 'border-r-4 border-fuchsia-500'
                                                                : ''
                                                                }`}>
                                                                {isActualFlight(flight) && flight.route && (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                // 로컬 상태 즉시 업데이트
                                                                                setLocalFlights(prevFlights =>
                                                                                    prevFlights.map(f =>
                                                                                        f.id === flight.id
                                                                                            ? { ...f, status: { ...f.status, departed: !f.status?.departed } }
                                                                                            : f
                                                                                    )
                                                                                );
                                                                                // 부모 컴포넌트 상태도 업데이트
                                                                                onStatusChange?.(flight.id, { departed: !flight.status?.departed });
                                                                            }}
                                                                            title="이륙 완료"
                                                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors cursor-pointer ${flight.status?.departed
                                                                                ? 'bg-blue-600 hover:bg-blue-500'
                                                                                : 'bg-white/20 hover:bg-blue-500/50'
                                                                                }`}
                                                                        >
                                                                            T
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                // 로컬 상태 즉시 업데이트
                                                                                setLocalFlights(prevFlights =>
                                                                                    prevFlights.map(f =>
                                                                                        f.id === flight.id
                                                                                            ? { ...f, status: { ...f.status, landed: !f.status?.landed } }
                                                                                            : f
                                                                                    )
                                                                                );
                                                                                // 부모 컴포넌트 상태도 업데이트
                                                                                onStatusChange?.(flight.id, { landed: !flight.status?.landed });
                                                                            }}
                                                                            title="착륙 완료"
                                                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors cursor-pointer ${flight.status?.landed
                                                                                ? 'bg-emerald-600 hover:bg-emerald-500'
                                                                                : 'bg-white/20 hover:bg-emerald-500/50'
                                                                                }`}
                                                                        >
                                                                            L
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            });
                                        });

                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-slate-400 text-center py-8">해당 월의 스케줄이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MonthlyScheduleModal;