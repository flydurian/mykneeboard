import React, { useState, useMemo, useRef } from 'react';
import { Flight } from '../../types';
import { XIcon } from '../icons';
import { toZonedTime, format } from 'date-fns-tz';
import { eachDayOfInterval, startOfDay, endOfDay, add } from 'date-fns';
import { isKoreanHoliday } from '../../utils/holidays';
import { getTimezone, getFlightTime } from '../../utils/cityData';


interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    flights: Flight[];
    month: number;
    year: number;
    onFlightClick: (flight: Flight) => void;
}

const CalendarModal: React.FC<CalendarModalProps> = ({ 
    isOpen, 
    onClose, 
    flights, 
    month, 
    year, 
    onFlightClick 
}) => {
    const [currentDate, setCurrentDate] = useState(new Date(year, month - 1, 1));
    const todayStr = useMemo(() => format(toZonedTime(new Date(), 'Asia/Seoul'), 'yyyy-MM-dd'), []);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // 스와이프 관련 상태
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    // 공항 코드에 해당하는 IANA 타임존 이름을 반환
    const getTimezoneForAirport = (airportCode: string): string | null => {
        return getTimezone(airportCode);
    };

    // 비행 시간 계산 함수
    const getFlightDuration = (route: string) => {
        return getFlightTime(route) || { hours: 12, minutes: 0 };
    };

    // 종합적인 캘린더 이벤트 생성 (비행 중 + 체류 기간 포함)
    const generateComprehensiveCalendarEvents = (originalFlights: Flight[]) => {
        const calendarEvents: Array<{
            title: string;
            date: string;
            flight?: Flight;
            isStby: boolean;
            isLayover?: boolean;
            isGroundStudent?: boolean;
        }> = [];
        const KOREA_TIME_ZONE = 'Asia/Seoul';

        // STBY 스케줄 처리 (한국시간 기준)
        const stbyFlights = originalFlights.filter(flight => 
            flight.flightNumber.toUpperCase().includes('STBY') || 
            flight.flightNumber.toUpperCase().includes('STANDBY') ||
            flight.flightNumber.toUpperCase().includes('대기') ||
            flight.flightNumber.toUpperCase().includes('STB')
        );

        // G/S STUDENT 지상 스케줄 처리 (한국시간 기준)
        const groundStudentFlights = originalFlights.filter(flight => 
            flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
            flight.flightNumber.toUpperCase().includes('GS STUDENT')
        );

        stbyFlights.forEach(flight => {
            calendarEvents.push({
                title: flight.flightNumber,
                date: flight.date,
                flight,
                isStby: true
            });
        });

        // G/S STUDENT 지상 스케줄 이벤트 추가
        groundStudentFlights.forEach(flight => {
            calendarEvents.push({
                title: flight.flightNumber,
                date: flight.date,
                flight,
                isStby: false,
                isGroundStudent: true
            });
        });

        // 일반 비행 스케줄 처리
        const regularFlights = originalFlights.filter(flight => 
            !flight.flightNumber.toUpperCase().includes('STBY') && 
            !flight.flightNumber.toUpperCase().includes('STANDBY') &&
            !flight.flightNumber.toUpperCase().includes('대기') &&
            !flight.flightNumber.toUpperCase().includes('STB') &&
            !flight.flightNumber.toUpperCase().includes('G/S STUDENT') &&
            !flight.flightNumber.toUpperCase().includes('GS STUDENT')
        );

        // 1. 모든 항공편의 출발/도착 시간을 KST 기준으로 계산
        // console.log('Processing regular flights:', regularFlights.length);
        const flightsWithKstTimes = regularFlights.map(flight => {
            // 방어 코드: route가 유효하지 않으면 이 비행을 건너뜁니다.
            if (!flight.route || !flight.route.includes('/') || flight.route.startsWith('/') || flight.route.endsWith('/')) {
                return null;
            }

            const [depAirport, arrAirport] = flight.route.split('/');

            // 방어 코드: 공항 코드가 비어있으면 건너뜁니다.
            if (!depAirport || !arrAirport) {
                return null;
            }

            const depTz = getTimezoneForAirport(depAirport);

            if (!depTz) {
                console.warn(`'${depAirport}' 공항의 타임존 정보를 찾을 수 없습니다.`);
                return null;
            }

            // 출발 시간이 없는 경우 기본값 사용
            const departureTime = flight.std || '00:00:00';
            const departureDateTimeString = `${flight.date}T${departureTime}`;
            
            // 출발 시간을 현지 시간 기준으로 한국 시간으로 변환 (섬머타임 자동 반영)
            let departureKst: Date;
            if (depAirport === 'ICN') {
                // ICN 출발은 이미 한국시간이므로 그대로 사용
                departureKst = new Date(departureDateTimeString);
            } else {
                // 다른 공항 출발은 현지시간을 한국시간으로 변환
                const depTz = getTimezoneForAirport(depAirport);
                if (depTz) {
                    const offset = format(new Date(flight.date), 'xxx', { timeZone: depTz });
                    const fullISOString = `${flight.date}T${departureTime}${offset}`;
                    departureKst = new Date(fullISOString);
                } else {
                    // 타임존 정보가 없는 경우 기본값 사용
                    const localDate = new Date(departureDateTimeString);
                    departureKst = new Date(localDate.getTime() + (9 * 60 * 60 * 1000));
                }
            }

            // 도착 시간 처리 (STA가 있으면 사용, 없으면 비행 시간으로 계산)
            let arrivalKst: Date;
            if (flight.sta) {
                // 1. UTC 출발시간에 비행시간을 더해 예상 UTC 도착시간 계산
                const duration = getFlightDuration(flight.route);
                const estimatedArrivalUtc = add(departureKst, { hours: duration.hours, minutes: duration.minutes });

                // 2. 예상 UTC 도착시간을 도착지 현지 시간으로 변환하여 '날짜' 추출
                const arrTz = getTimezoneForAirport(arrAirport) || KOREA_TIME_ZONE;
                const arrivalDateStr = format(estimatedArrivalUtc, 'yyyy-MM-dd', { timeZone: arrTz });
                
                // 3. 추출된 날짜와 실제 STA 시간을 조합
                const arrivalDateTimeStringNoOffset = `${arrivalDateStr}T${flight.sta}`;

                if (arrAirport === 'ICN') {
                    arrivalKst = new Date(arrivalDateTimeStringNoOffset);
                } else {
                    // 4. 최종 현지 도착시간을 한국시간으로 변환
                    const arrivalOffset = format(new Date(arrivalDateStr), 'xxx', { timeZone: arrTz });
                    const finalArrivalISOString = `${arrivalDateTimeStringNoOffset}${arrivalOffset}`;
                    arrivalKst = new Date(finalArrivalISOString);
                }
            } else {
                // 도착 시간이 없는 경우 비행 시간으로 계산
                const duration = getFlightDuration(flight.route);
                arrivalKst = add(departureKst, { hours: duration.hours, minutes: duration.minutes });
            }

            /*
            console.log(`Flight ${flight.flightNumber} (${flight.route}):`, {
                originalDate: flight.date,
                departureTime: flight.std,
                arrivalTime: flight.sta,
                depAirport,
                arrAirport,
                departureKst: departureKst.toISOString(),
                arrivalKst: arrivalKst.toISOString(),
                useActualArrivalTime: !!flight.sta
            });
            */
            
            return {
                ...flight,
                departureKst,
                arrivalKst,
                depAirport,
                arrAirport
            };
        }).filter(Boolean).sort((a, b) => a.departureKst.getTime() - b.departureKst.getTime());

        // 2. '비행 중'인 날짜에 목적지 이벤트 추가
        flightsWithKstTimes.forEach(flight => {
            const flightDays = eachDayOfInterval({
                start: startOfDay(flight.departureKst),
                end: startOfDay(flight.arrivalKst)
            });

            const destination = flight.route.split('/')[1]; // 예: 'JFK'

            flightDays.forEach(day => {
                // ✨ [핵심 수정] 모든 경우에 '목적지'를 제목으로 사용하도록 통일
                calendarEvents.push({
                    title: destination,
                    date: format(day, 'yyyy-MM-dd'),
                    flight,
                    isStby: false
                });
            });
        });

        // 3. '체류 기간' 이벤트 추가
        for (let i = 0; i < flightsWithKstTimes.length - 1; i++) {
            const outbound = flightsWithKstTimes[i];
            const inbound = flightsWithKstTimes[i + 1];

            // 왕복 비행 패턴 찾기 (ICN->XXX 편과 XXX->ICN 편이 순서대로 있는 경우)
            if (outbound.route.startsWith('ICN/') && inbound.route.endsWith('/ICN') && 
                outbound.route.split('/')[1] === inbound.route.split('/')[0]) {
                
                const destination = outbound.route.split('/')[1];
                const layoverStart = endOfDay(outbound.arrivalKst);
                const layoverEnd = startOfDay(inbound.departureKst);

                if (layoverStart < layoverEnd) {
                    const layoverDays = eachDayOfInterval({ start: layoverStart, end: layoverEnd });
                    layoverDays.forEach(day => {
                        calendarEvents.push({
                            title: destination,
                            date: format(day, 'yyyy-MM-dd'),
                            isStby: false,
                            isLayover: true
                        });
                    });
                }
            }
        }

        // 4. 중복 이벤트 제거
        const uniqueEvents = Array.from(new Map(calendarEvents.map(event =>
            [`${event.date}-${event.title}-${event.isStby}-${event.isLayover}`, event]
        )).values());

        return uniqueEvents;
    };

    // 달력 데이터 생성
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // 원본 데이터를 달력 이벤트로 변환
        const calendarEvents = generateComprehensiveCalendarEvents(flights);
        
        const days = [];
        const iterDate = new Date(startDate);
        
        while (iterDate <= lastDay || iterDate.getDay() !== 0) {
            // 달력 날짜를 한국시간 기준으로 생성
            const koreanDate = new Date(iterDate.getTime() + (9 * 60 * 60 * 1000));
            const dateStr = koreanDate.toISOString().split('T')[0];
            
            // 해당 날짜의 이벤트 찾기
            const dayEvents = calendarEvents.filter(event => event.date === dateStr);
            
            days.push({
                date: new Date(iterDate),
                dateStr,
                isCurrentMonth: iterDate.getMonth() === month,
                events: dayEvents
            });
            
            iterDate.setDate(iterDate.getDate() + 1);
        }
        
        return days;
    }, [currentDate, flights]);

    // 달력 데이터 처리 (새로운 이벤트 기반 방식)
    const processedCalendarData = useMemo(() => {
        return calendarData;
    }, [calendarData]);

    // 이전/다음 월 이동
    const goToPreviousMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    // 스와이프 이벤트 핸들러
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            goToNextMonth();
        }
        if (isRightSwipe) {
            goToPreviousMonth();
        }
    };

    // 요일 헤더
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 md:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg h-full flex flex-col p-4 md:p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                
                {/* 헤더 */}
                <div className="flex-shrink-0 flex items-center justify-between mb-4 md:mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                    </h2>

                    {/* 컨트롤 버튼 그룹 (오른쪽) */}
                    <div className="flex items-center gap-1 md:gap-2">
                        {/* 월 이동 버튼 */}
                        <button
                            onClick={goToPreviousMonth}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={goToNextMonth}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* 닫기 버튼 */}
                        <button 
                            onClick={onClose} 
                            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 달력 & 범례 컨테이너 */}
                                    <div 
                                        className={`flex-grow overflow-y-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                                        onScroll={handleScroll}
                                        onTouchStart={onTouchStart}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={onTouchEnd}
                                    >
                    {/* 달력 */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* 요일 헤더 */}
                        {weekDays.map(day => (
                            <div key={day} className="p-2 md:p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <span className="hidden md:inline">{day}</span>
                                <span className="md:hidden">{day.charAt(0)}</span>
                            </div>
                        ))}
                        
                        {/* 날짜 셀 */}
                        {processedCalendarData.map((day, index) => {
                            const dayOfWeek = day.date.getDay(); // 0: Sunday, 6: Saturday
                            const isSunday = dayOfWeek === 0;
                            const isSaturday = dayOfWeek === 6;
                            const isHoliday = isKoreanHoliday(day.date);

                            // 배경색 결정
                            let dayBgClass = 'bg-white dark:bg-gray-800';
                            if (day.isCurrentMonth) {
                                if (isSunday) dayBgClass = 'bg-red-50 dark:bg-red-900/20';
                                if (isSaturday) dayBgClass = 'bg-blue-50 dark:bg-blue-900/20';
                            } else {
                                dayBgClass = 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500';
                            }

                            // 날짜 텍스트 색상 결정
                            let dateTextClass = 'dark:text-gray-300';
                            if (day.isCurrentMonth) {
                                if (isHoliday && !isSunday) dateTextClass = 'text-red-500 dark:text-red-400'; // 공휴일(일요일 제외)
                                if (isSunday) dateTextClass = 'text-red-500 dark:text-red-400'; // 일요일
                            }

                            return (
                                <div
                                    key={index}
                                    className={`min-h-[90px] md:min-h-[120px] p-1 md:p-2 rounded-lg ${dayBgClass} ${
                                        day.dateStr === todayStr && day.isCurrentMonth
                                            ? 'border-2 border-blue-500'
                                            : 'border border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <div className={`text-sm font-medium mb-1 ${dateTextClass}`}>
                                        {day.date.getDate()}
                                    </div>
                                    
                                    {/* 비행 스케줄 */}
                                    <div className="space-y-1">
                                        {day.events
                                            .sort((a, b) => {
                                                // 출발편 → 체류기간 → 돌아오는 편 순서로 정렬
                                                // 출발편 (ICN으로 시작하는 편)
                                                const aIsDeparture = a.flight?.route?.startsWith('ICN/');
                                                const bIsDeparture = b.flight?.route?.startsWith('ICN/');
                                                
                                                // 체류기간
                                                const aIsLayover = a.isLayover;
                                                const bIsLayover = b.isLayover;
                                                
                                                // 돌아오는 편 (ICN으로 끝나는 편)
                                                const aIsReturn = a.flight?.route?.endsWith('/ICN');
                                                const bIsReturn = b.flight?.route?.endsWith('/ICN');
                                                
                                                // 출발편이 가장 위
                                                if (aIsDeparture && !bIsDeparture) return -1;
                                                if (!aIsDeparture && bIsDeparture) return 1;
                                                
                                                // 체류기간이 중간
                                                if (aIsLayover && !bIsLayover) return -1;
                                                if (!aIsLayover && bIsLayover) return 1;
                                                
                                                // 돌아오는 편이 가장 아래
                                                if (aIsReturn && !bIsReturn) return 1;
                                                if (!aIsReturn && bIsReturn) return -1;
                                                
                                                return 0;
                                            })
                                            .map((event, index) => {
                                            const isSpecialEvent = event.isStby || event.isGroundStudent;
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => event.flight && onFlightClick(event.flight)}
                                                    className={`p-1 rounded cursor-pointer transition-colors ${
                                                        isSpecialEvent ? 'text-[11px]' : 'text-xs'
                                                    } ${
                                                        event.isStby 
                                                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800' 
                                                            : event.isGroundStudent
                                                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800'
                                                            : event.isLayover
                                                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                                                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                                                    }`}
                                                    title={event.flight 
                                                        ? `${event.flight.flightNumber} - ${event.flight.route}`
                                                        : event.title
                                                    }
                                                >
                                                    <div className="font-medium whitespace-normal break-words">
                                                        {event.title}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 범례 */}
                    <div className="mt-4 md:mt-6 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">범례 (한국시간 기준)</h3>
                        <div className="flex items-center gap-x-3 gap-y-1 md:gap-4 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900 rounded"></div>
                                <span>비행 스케줄</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900 rounded"></div>
                                <span>STBY 스케줄</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-purple-100 dark:bg-purple-900 rounded"></div>
                                <span>G/S STUDENT</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-100 dark:bg-green-900 rounded"></div>
                                <span>체류 기간</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded"></div>
                                <span>다른 월</span>
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <p>• 모든 스케줄: 한국시간으로 변환하여 표시</p>
                            <p>• 달력 날짜: 한국시간 기준</p>
                            <p>• 왕복 비행: 출발일과 체류 기간을 구분하여 표시</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarModal;
