import React, { useState, useMemo } from 'react';
import { Flight } from '../../types';
import { XIcon } from '../icons';
import { isKoreanHoliday } from '../../utils/holidays';

interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    flights: Flight[];
    month: number;
    year: number;
    onFlightClick: (flight: Flight) => void;
    onMonthChange?: (year: number, month: number) => void;
}

const CalendarModal: React.FC<CalendarModalProps> = ({
    isOpen,
    onClose,
    flights,
    month,
    year,
    onFlightClick,
    onMonthChange
}) => {
    // 달력 이벤트 생성 (한국시간 기준, 출발일과 도착일 모두 표시)
    const calendarEvents = useMemo(() => {
        const events: Array<{
            title: string;
            date: string;
            flight: Flight;
        }> = [];

        flights.forEach(flight => {
            // STBY, SIM, 특별스케줄 판별
            const isStandby = flight.flightNumber.includes('STBY') || flight.flightNumber.includes('OTHRDUTY') || flight.flightNumber.includes('RESERVE');
            const isSimSchedule = flight.flightNumber.toUpperCase().includes('SIM');
            const isVacationSchedule = flight.flightNumber.toUpperCase().includes('ANNUAL LEAVE') ||
                flight.flightNumber.toUpperCase().includes('ALV') ||
                flight.flightNumber.toUpperCase().includes('ALM') ||
                flight.flightNumber.toUpperCase().includes('VAC_R') ||
                flight.flightNumber.toUpperCase().includes('VAC');
            const isSpecialSchedule = flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                flight.flightNumber.toUpperCase().includes('G/S') ||
                flight.flightNumber.toUpperCase().includes('GS') ||
                flight.flightNumber.toUpperCase().includes('GROUND SCHOOL') ||
                flight.flightNumber.toUpperCase().includes('MEDICAL CHK') ||
                flight.flightNumber.toUpperCase().includes('MEDICAL') ||
                flight.flightNumber.toUpperCase().includes('안전회의') ||
                flight.flightNumber.toUpperCase().includes('SAFETY') ||
                flight.flightNumber.toUpperCase().includes('TRAINING') ||
                flight.flightNumber.toUpperCase().includes('교육') ||
                flight.flightNumber.toUpperCase().includes('BRIEFING') ||
                flight.flightNumber.toUpperCase().includes('브리핑') ||
                flight.flightNumber.toUpperCase().includes('MEETING') ||
                flight.flightNumber.toUpperCase().includes('회의') ||
                flight.flightNumber.toUpperCase().includes('CHECK') ||
                flight.flightNumber.toUpperCase().includes('점검') ||
                flight.flightNumber.toUpperCase().includes('INSPECTION') ||
                flight.flightNumber.toUpperCase().includes('검사');

            let title: string;

            if (flight.route) {
                // 일반 항공편: 노선에서 도착지만 추출 (예: ICN/JFK -> JFK)
                const destination = flight.route.split('/')[1];
                if (destination) {
                    title = destination;
                } else {
                    title = flight.flightNumber;
                }
            } else if (isVacationSchedule) {
                // 휴가스케줄
                title = flight.flightNumber;
            } else if (isStandby) {
                // STBY 스케줄
                title = 'STBY';
            } else if (isSimSchedule) {
                // SIM 스케줄: 원본 항공편 번호 표시
                title = flight.flightNumber;
            } else if (isSpecialSchedule) {
                // 특별스케줄: 항공편 번호 그대로 표시
                title = flight.flightNumber;
            } else {
                // 기타: 항공편 번호 표시
                title = flight.flightNumber;
            }

            const dates = new Set<string>(); // 중복 날짜 제거용

            // 휴가 스케줄, 특별 스케줄, SIM 스케줄인 경우 날짜만 사용
            if (isVacationSchedule || isSpecialSchedule || isSimSchedule) {
                // flight.date를 직접 사용 (YYYY-MM-DD 형식)
                if (flight.date) {
                    dates.add(flight.date);
                }
            } else {
                // 일반 비행 스케줄의 경우 출발일과 도착일 처리

                // 출발일 처리
                if (flight.departureDateTimeUtc) {
                    const departureUtc = new Date(flight.departureDateTimeUtc);
                    const departureKst = new Date(departureUtc.getTime() + 9 * 60 * 60 * 1000);

                    const depYear = departureKst.getUTCFullYear();
                    const depMonth = String(departureKst.getUTCMonth() + 1).padStart(2, '0');
                    const depDay = String(departureKst.getUTCDate()).padStart(2, '0');
                    const depDateStr = `${depYear}-${depMonth}-${depDay}`;

                    dates.add(depDateStr);
                }

                // 도착일 처리
                if (flight.arrivalDateTimeUtc) {
                    const arrivalUtc = new Date(flight.arrivalDateTimeUtc);
                    const arrivalKst = new Date(arrivalUtc.getTime() + 9 * 60 * 60 * 1000);

                    const arrYear = arrivalKst.getUTCFullYear();
                    const arrMonth = String(arrivalKst.getUTCMonth() + 1).padStart(2, '0');
                    const arrDay = String(arrivalKst.getUTCDate()).padStart(2, '0');
                    const arrDateStr = `${arrYear}-${arrMonth}-${arrDay}`;

                    dates.add(arrDateStr);
                }
            }

            // 중복 제거된 날짜들에 대해 이벤트 추가
            dates.forEach(dateStr => {
                events.push({
                    title: title,
                    date: dateStr,
                    flight
                });
            });
        });

        // 날짜별로 그룹화하고 각 날짜 내에서 STD 시간순으로 정렬
        const eventsByDate = events.reduce((acc, event) => {
            if (!acc[event.date]) {
                acc[event.date] = [];
            }
            acc[event.date].push(event);
            return acc;
        }, {} as { [date: string]: typeof events });

        // 각 날짜별로 STD 시간순으로 정렬
        Object.keys(eventsByDate).forEach(date => {
            eventsByDate[date].sort((a, b) => {
                const stdA = a.flight.std || '00:00';
                const stdB = b.flight.std || '00:00';
                return stdA.localeCompare(stdB);
            });
        });

        // 정렬된 이벤트들을 다시 배열로 변환
        const sortedEvents: typeof events = [];
        Object.keys(eventsByDate).sort().forEach(date => {
            sortedEvents.push(...eventsByDate[date]);
        });

        return sortedEvents;
    }, [flights]);


    // 달력 데이터 생성
    const calendarData = useMemo(() => {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0); // 현재 월의 마지막 날
        const firstDayOfWeek = firstDay.getDay(); // 0=일요일, 1=월요일
        const lastDayOfWeek = lastDay.getDay(); // 마지막 날의 요일
        const daysInMonth = lastDay.getDate(); // 현재 월의 일수

        // 달력 시작일 (첫째 날 이전의 일요일부터)
        const startDay = 1 - firstDayOfWeek;

        // 필요한 주수 계산
        const totalDays = Math.abs(startDay) + daysInMonth; // 이전 달에서 가져오는 일수 + 현재 월 일수
        const weeksNeeded = Math.ceil(totalDays / 7); // 필요한 주수

        const days = [];

        // 필요한 주수만큼만 생성
        for (let i = 0; i < weeksNeeded * 7; i++) {
            const dayNumber = startDay + i;

            // 날짜 계산
            let dayYear = year;
            let dayMonth = month - 1; // JavaScript는 0부터 시작
            let day = dayNumber;

            // 음수 날짜 처리 (이전 달)
            if (day <= 0) {
                dayMonth--;
                if (dayMonth < 0) {
                    dayMonth = 11;
                    dayYear--;
                }
                const daysInPrevMonth = new Date(dayYear, dayMonth + 1, 0).getDate();
                day = daysInPrevMonth + day;
            }
            // 다음달 날짜 처리
            else {
                const daysInCurrentMonth = new Date(dayYear, dayMonth + 1, 0).getDate();
                if (day > daysInCurrentMonth) {
                    day = day - daysInCurrentMonth;
                    dayMonth++;
                    if (dayMonth > 11) {
                        dayMonth = 0;
                        dayYear++;
                    }
                }
            }

            // 날짜 문자열 생성
            const dateStr = `${dayYear}-${String(dayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // 해당 날짜의 이벤트 찾기
            const dayEvents = calendarEvents.filter(event => event.date === dateStr);

            // 현재 월인지 확인 (년도도 함께 확인)
            const isCurrentMonth = dayYear === year && dayMonth === (month - 1);

            // 요일 계산 (0=일요일, 6=토요일)
            const dayOfWeek = new Date(dayYear, dayMonth, day).getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isHoliday = isKoreanHoliday(new Date(dayYear, dayMonth, day));

            days.push({
                day,
                dateStr,
                isCurrentMonth,
                isSunday,
                isSaturday,
                isHoliday,
                events: dayEvents
            });
        }

        return days;
    }, [year, month, calendarEvents]);

    // 월 이동 함수들
    const goToPreviousMonth = () => {
        if (onMonthChange) {
            let newYear = year;
            let newMonth = month - 1;
            if (newMonth < 1) {
                newMonth = 12;
                newYear--;
            }
            onMonthChange(newYear, newMonth);
        }
    };

    const goToNextMonth = () => {
        if (onMonthChange) {
            let newYear = year;
            let newMonth = month + 1;
            if (newMonth > 12) {
                newMonth = 1;
                newYear++;
            }
            onMonthChange(newYear, newMonth);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-2 sm:p-4 pt-safe" onClick={onClose} onTouchEnd={onClose}>
            <div
                className="glass-panel rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl p-2 sm:p-6 md:p-8 relative animate-fade-in-up flex flex-col overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
                    maxHeight: '95vh',
                    maxWidth: 'calc(100vw - 16px)'
                }}
                onClick={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                {/* 배경 그라데이션 효과 */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />

                {/* 헤더 영역 */}
                <div className="relative z-10 flex items-center justify-between mb-2 sm:mb-6 shrink-0 pl-1">
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                        {year}년 {month}월
                    </h2>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* 월 이동 버튼들 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); goToPreviousMonth(); }}
                            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); goToPreviousMonth(); }}
                            className="p-3 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="이전 달"
                        >
                            <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToNextMonth(); }}
                            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); goToNextMonth(); }}
                            className="p-3 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="다음 달"
                        >
                            <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                            className="p-3 sm:p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 transition-all active:scale-95 ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="닫기"
                        >
                            <XIcon className="w-5 h-5 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 pb-2 scrollbar-hide">
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-0.5 sm:gap-2 mb-1 sm:mb-3">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => {
                            const isSunday = index === 0;
                            const isSaturday = index === 6;
                            return (
                                <div
                                    key={day}
                                    className={`
                                    text-center text-xs sm:text-sm font-bold py-2 sm:py-3 rounded-xl border
                                    ${isSunday
                                            ? 'bg-gradient-to-br from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-500/10'
                                            : isSaturday
                                                ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300 shadow-lg shadow-blue-500/10'
                                                : 'bg-white/5 border-white/10 text-slate-300'
                                        }
                                `}
                                >
                                    {day}
                                </div>
                            );
                        })}
                    </div>

                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {calendarData.map((day, index) => {
                            const isToday = (() => {
                                const today = new Date();
                                const todayKst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
                                const todayYear = todayKst.getUTCFullYear();
                                const todayMonth = todayKst.getUTCMonth() + 1;
                                const todayDate = todayKst.getUTCDate();
                                return day.day === todayDate && year === todayYear && month === todayMonth && day.isCurrentMonth;
                            })();

                            return (
                                <div
                                    key={index}
                                    className={`
                                    min-h-[70px] sm:min-h-[90px] md:min-h-[110px] lg:min-h-[130px] p-1.5 sm:p-2 rounded-xl transition-all duration-200
                                    ${isToday
                                            ? 'border-2 border-fuchsia-500 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/10'
                                            : day.isCurrentMonth
                                                ? (day.isHoliday || day.isSunday
                                                    ? 'border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-rose-600/5 hover:border-rose-500/40'
                                                    : day.isSaturday
                                                        ? 'border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 hover:border-blue-500/40'
                                                        : 'border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                                )
                                                : 'border border-white/5 bg-black/20 text-slate-600'
                                        }
                                `}
                                >
                                    <div className={`
                                    text-sm sm:text-base md:text-lg font-bold mb-1
                                    ${day.isCurrentMonth
                                            ? (day.isHoliday || day.isSunday ? 'text-rose-300' : day.isSaturday ? 'text-blue-300' : 'text-slate-200')
                                            : 'text-slate-600'
                                        }
                                    ${isToday ? 'text-fuchsia-300' : ''}
                                `}>
                                        {day.day}
                                    </div>

                                    {/* 이벤트 표시 - 최대 3개 + 나머지 카운트 */}
                                    <div className="space-y-0.5 sm:space-y-1">
                                        {day.events.slice(0, 3).map((event, eventIndex) => {
                                            const isStandby = event.flight.flightNumber.includes('STBY') ||
                                                event.flight.flightNumber.includes('OTHRDUTY') ||
                                                event.flight.flightNumber.includes('RESERVE') ||
                                                event.flight.scheduleType === 'STANDBY';
                                            const isSimSchedule = event.flight.flightNumber.toUpperCase().includes('SIM');
                                            const isVacationSchedule = event.flight.flightNumber.toUpperCase().includes('ANNUAL LEAVE') ||
                                                event.flight.flightNumber.toUpperCase().includes('ALV') ||
                                                event.flight.flightNumber.toUpperCase().includes('ALM') ||
                                                event.flight.flightNumber.toUpperCase().includes('VAC_R') ||
                                                event.flight.flightNumber.toUpperCase().includes('VAC');
                                            const isSpecialSchedule = event.flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                                                event.flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                                                event.flight.flightNumber.toUpperCase().includes('G/S') ||
                                                event.flight.flightNumber.toUpperCase().includes('GS') ||
                                                event.flight.flightNumber.toUpperCase().includes('GROUND SCHOOL') ||
                                                event.flight.flightNumber.toUpperCase().includes('MEDICAL CHK') ||
                                                event.flight.flightNumber.toUpperCase().includes('MEDICAL') ||
                                                event.flight.flightNumber.toUpperCase().includes('안전회의') ||
                                                event.flight.flightNumber.toUpperCase().includes('SAFETY') ||
                                                event.flight.flightNumber.toUpperCase().includes('TRAINING') ||
                                                event.flight.flightNumber.toUpperCase().includes('교육') ||
                                                event.flight.flightNumber.toUpperCase().includes('BRIEFING') ||
                                                event.flight.flightNumber.toUpperCase().includes('브리핑') ||
                                                event.flight.flightNumber.toUpperCase().includes('MEETING') ||
                                                event.flight.flightNumber.toUpperCase().includes('회의') ||
                                                event.flight.flightNumber.toUpperCase().includes('CHECK') ||
                                                event.flight.flightNumber.toUpperCase().includes('점검') ||
                                                event.flight.flightNumber.toUpperCase().includes('INSPECTION') ||
                                                event.flight.flightNumber.toUpperCase().includes('검사');

                                            const isKESchedule = event.flight.flightNumber.startsWith('KE') ||
                                                event.flight.flightNumber.match(/^\d+$/) &&
                                                event.flight.scheduleType === 'FLIGHT';
                                            const isOZSchedule = event.flight.scheduleType === 'OZ' ||
                                                (event.flight.flightNumber.match(/^\d+$/) &&
                                                    event.flight.scheduleType !== '7C' &&
                                                    event.flight.scheduleType !== 'FLIGHT') ||
                                                event.flight.flightNumber.toUpperCase().includes('FIXED SKD') ||
                                                event.flight.flightNumber.toUpperCase().includes('ORAL');
                                            const is7CSchedule = event.flight.scheduleType === '7C' &&
                                                !isSpecialSchedule && !isSimSchedule && !isVacationSchedule;

                                            let bgGradient, borderColor, shadowColor;
                                            if (isVacationSchedule) {
                                                bgGradient = 'from-rose-600 to-rose-700';
                                                borderColor = 'border-rose-400/30';
                                                shadowColor = 'hover:shadow-rose-500/50';
                                            } else if (isStandby) {
                                                bgGradient = 'from-amber-600 to-amber-700';
                                                borderColor = 'border-amber-400/30';
                                                shadowColor = 'hover:shadow-amber-500/50';
                                            } else if (isSimSchedule) {
                                                bgGradient = 'from-emerald-600 to-emerald-700';
                                                borderColor = 'border-emerald-400/30';
                                                shadowColor = 'hover:shadow-emerald-500/50';
                                            } else if (isSpecialSchedule) {
                                                bgGradient = 'from-purple-600 to-purple-700';
                                                borderColor = 'border-purple-400/30';
                                                shadowColor = 'hover:shadow-purple-500/50';
                                            } else if (is7CSchedule) {
                                                bgGradient = 'from-orange-600 to-orange-700';
                                                borderColor = 'border-orange-400/30';
                                                shadowColor = 'hover:shadow-orange-500/50';
                                            } else if (isOZSchedule) {
                                                bgGradient = 'from-indigo-600 to-indigo-700';
                                                borderColor = 'border-indigo-400/30';
                                                shadowColor = 'hover:shadow-indigo-500/50';
                                            } else if (isKESchedule) {
                                                bgGradient = 'from-sky-600 to-sky-700';
                                                borderColor = 'border-sky-400/30';
                                                shadowColor = 'hover:shadow-sky-500/50';
                                            } else {
                                                bgGradient = 'from-slate-600 to-slate-700';
                                                borderColor = 'border-slate-400/30';
                                                shadowColor = 'hover:shadow-slate-500/50';
                                            }

                                            return (
                                                <div
                                                    key={eventIndex}
                                                    className={`
                                                    text-[8px] sm:text-[10px] md:text-xs
                                                    bg-gradient-to-r ${bgGradient}
                                                    text-white font-medium
                                                    px-1 sm:px-2 py-0.5 sm:py-1.5
                                                    rounded-full border ${borderColor}
                                                    cursor-pointer truncate sm:break-words leading-tight
                                                    shadow-sm sm:shadow-md ${shadowColor}
                                                    transition-all duration-200
                                                    hover:scale-105 hover:shadow-lg
                                                    active:scale-95
                                                    backdrop-blur-sm
                                                    text-center
                                                `}
                                                    onClick={() => onFlightClick(event.flight)}
                                                    title={event.title}
                                                >
                                                    {event.title}
                                                </div>
                                            );
                                        })}
                                        {day.events.length > 3 && (
                                            <div className="text-[8px] sm:text-[10px] text-slate-300 font-bold px-1 sm:px-2 py-0.5 text-center bg-white/10 rounded-full border border-white/20 mt-0.5 hover:bg-white/20 transition-colors">
                                                +{day.events.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarModal;
