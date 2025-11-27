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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-4xl p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                {/* 월 이동 버튼들 */}
                <div className="absolute top-4 right-16 flex gap-2">
                    <button
                        onClick={goToPreviousMonth}
                        className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="이전 달"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="다음 달"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6">
                    {year}년 {month}월
                </h2>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => {
                        const isSunday = index === 0;
                        const isSaturday = index === 6;
                        return (
                            <div
                                key={day}
                                className={`
                                    text-center text-sm font-medium py-2 border border-white/10 rounded-lg
                                    ${isSunday
                                        ? 'bg-rose-500/20 text-rose-400' // 일요일: 연한 빨간색
                                        : isSaturday
                                            ? 'bg-blue-500/20 text-blue-400' // 토요일: 연한 파란색
                                            : 'bg-white/5 text-slate-200' // 평일: 기본색
                                    }
                                `}
                            >
                                {day}
                            </div>
                        );
                    })}
                </div>

                {/* 달력 그리드 */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarData.map((day, index) => (
                        <div
                            key={index}
                            className={`
                                min-h-[60px] sm:min-h-[80px] md:min-h-[100px] lg:min-h-[120px] p-1 sm:p-2 border border-white/10 rounded-lg transition-colors
                                ${day.isCurrentMonth
                                    ? (day.isHoliday
                                        ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' // 공휴일
                                        : day.isSunday
                                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' // 일요일
                                            : day.isSaturday
                                                ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' // 토요일
                                                : 'bg-white/5 text-slate-200 hover:bg-white/10' // 평일
                                    )
                                    : 'bg-black/20 text-slate-600'
                                }
                                ${(() => {
                                    const today = new Date();
                                    const todayKst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
                                    const todayYear = todayKst.getUTCFullYear();
                                    const todayMonth = todayKst.getUTCMonth() + 1;
                                    const todayDate = todayKst.getUTCDate();

                                    return day.day === todayDate &&
                                        year === todayYear &&
                                        month === todayMonth &&
                                        day.isCurrentMonth
                                        ? 'ring-2 ring-fuchsia-500 bg-fuchsia-500/10'
                                        : '';
                                })()}
                            `}
                        >
                            <div className="text-xs sm:text-sm md:text-base font-medium mb-1">
                                {day.day}
                            </div>

                            {/* 이벤트 표시 */}
                            <div className="space-y-0.5 sm:space-y-1">
                                {day.events.map((event, eventIndex) => {
                                    // STBY, SIM, 휴가스케줄, 특별스케줄 판별
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

                                    // 항공사 구분 (KE vs OZ vs 7C)
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

                                    // 색상 결정 (OZ 달력 표시 방식 기준)
                                    let bgColor, hoverColor;
                                    if (isVacationSchedule) {
                                        bgColor = 'bg-rose-600';
                                        hoverColor = 'hover:bg-rose-500';
                                    } else if (isStandby) {
                                        bgColor = 'bg-amber-600';
                                        hoverColor = 'hover:bg-amber-500';
                                    } else if (isSimSchedule) {
                                        bgColor = 'bg-emerald-600';
                                        hoverColor = 'hover:bg-emerald-500';
                                    } else if (isSpecialSchedule) {
                                        bgColor = 'bg-purple-600';
                                        hoverColor = 'hover:bg-purple-500';
                                    } else if (is7CSchedule) {
                                        // 7C 일반 비행 스케줄은 주황색으로 구분
                                        bgColor = 'bg-orange-600';
                                        hoverColor = 'hover:bg-orange-500';
                                    } else if (isOZSchedule) {
                                        // OZ 스케줄은 진한 파란색
                                        bgColor = 'bg-indigo-600';
                                        hoverColor = 'hover:bg-indigo-500';
                                    } else if (isKESchedule) {
                                        // KE 스케줄은 하늘색
                                        bgColor = 'bg-sky-600';
                                        hoverColor = 'hover:bg-sky-500';
                                    } else {
                                        // 기타 스케줄은 회색
                                        bgColor = 'bg-slate-600';
                                        hoverColor = 'hover:bg-slate-500';
                                    }

                                    return (
                                        <div
                                            key={eventIndex}
                                            className={`text-[10px] sm:text-xs md:text-sm lg:text-sm xl:text-sm ${bgColor} ${hoverColor} text-white px-1 sm:px-2 py-1 rounded cursor-pointer break-words leading-tight shadow-sm transition-colors`}
                                            onClick={() => onFlightClick(event.flight)}
                                            title={event.title} // 전체 제목을 툴팁으로 표시
                                        >
                                            {event.title}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CalendarModal;
