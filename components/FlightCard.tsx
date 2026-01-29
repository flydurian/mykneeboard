import React, { useMemo, memo, useCallback } from 'react';
import { Flight, FlightStatus } from '../types';
import { calculateDday, isActualFlight, getAirportCodeForCard } from '../utils/helpers';
import StatusBadge from './StatusBadge';
import { getCityInfo } from '../utils/cityData';
import { formatInTimeZone } from 'date-fns-tz';
import { motion } from 'framer-motion';

interface FlightCardProps {
    flight: Flight | undefined;
    type: 'last' | 'next' | 'nextNext';
    onClick: (flight: Flight | undefined, type: 'last' | 'next' | 'nextNext') => void;
    todayStr: string;
    onStatusChange?: (flightId: string, status: Partial<FlightStatus>) => void;
    baseIata?: string;
}

const FlightCard: React.FC<FlightCardProps> = memo(({ flight, type, onClick, todayStr, onStatusChange, baseIata }) => {
    const handleClick = useCallback((e: React.MouseEvent) => {
        // StatusBadge 버튼 클릭 시에는 카드 클릭 이벤트 방지
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        onClick(flight, type);
    }, [flight, type, onClick]);

    const ddayInfo = useMemo(() => {
        if (!flight) {
            return null;
        }

        try {
            if (!isActualFlight(flight)) {
                return null;
            }

            if (type === 'last') {
                // 최근 비행: 출발시간이 지나면 최근비행으로 분류, 날짜는 도착시간의 현지날짜 기준으로 계산
                if (flight.departureDateTimeUtc && flight.arrivalDateTimeUtc && flight.route) {
                    const departureUtc = new Date(flight.departureDateTimeUtc);
                    const arrivalUtc = new Date(flight.arrivalDateTimeUtc);
                    const nowUtc = new Date();

                    // 출발시간이 현재 시간보다 과거라면 최근 비행으로 분류
                    if (departureUtc <= nowUtc) {
                        const hasArrived = nowUtc >= arrivalUtc;

                        if (!hasArrived) {
                            // 출발지 현지 날짜 기준 (도착 전 구간)
                            const [depAirport, arrAirport] = flight.route ? flight.route.split('/') : ['ICN', 'ICN'];
                            const depTimezone = getCityInfo(depAirport)?.timezone || 'Asia/Seoul';

                            const departureLocal = new Date(departureUtc.toLocaleString('en-US', { timeZone: depTimezone }));
                            const nowLocal = new Date(nowUtc.toLocaleString('en-US', { timeZone: depTimezone }));
                            const depDate = new Date(departureLocal.getFullYear(), departureLocal.getMonth(), departureLocal.getDate());
                            const nowDate = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
                            const diffTime = nowDate.getTime() - depDate.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays === 0) return { text: '오늘', days: 0 };
                            if (diffDays === 1) return { text: '어제', days: -1 };
                            return { text: `${diffDays}일 전`, days: -diffDays };
                        } else {
                            // 도착 후에는 도착지 현지 날짜 기준
                            const arrAirport = flight.route && flight.route.includes('/') ? flight.route.split('/')[1] : 'ICN';
                            const arrTimezone = getCityInfo(arrAirport)?.timezone || 'Asia/Seoul';

                            const arrivalLocal = new Date(arrivalUtc.toLocaleString('en-US', { timeZone: arrTimezone }));
                            const nowLocal = new Date(nowUtc.toLocaleString('en-US', { timeZone: arrTimezone }));
                            const arrivalDate = new Date(arrivalLocal.getFullYear(), arrivalLocal.getMonth(), arrivalLocal.getDate());
                            const nowDate = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
                            const diffTime = nowDate.getTime() - arrivalDate.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays === 0) return { text: '오늘', days: 0 };
                            if (diffDays === 1) return { text: '어제', days: -1 };
                            return { text: `${diffDays}일 전`, days: -diffDays };
                        }
                    }
                }
            } else if (type === 'next' || type === 'nextNext') {
                // 다음 비행: 출발이 예정된 비행만 표시 (출발시간이 현재보다 미래)
                if (flight.departureDateTimeUtc && flight.route) {
                    const departureUtc = new Date(flight.departureDateTimeUtc);
                    const nowUtc = new Date();

                    // 출발시간이 현재 시간보다 과거라면 다음 비행이 아님
                    if (departureUtc <= nowUtc) {
                        return null;
                    }

                    // 출발지 시간대 정보 가져오기
                    const [depAirport] = flight.route ? flight.route.split('/') : ['ICN', 'ICN'];
                    const depTimezone = getCityInfo(depAirport)?.timezone || 'Asia/Seoul';

                    // 출발시간을 출발지 현지시간으로 변환
                    const departureLocal = new Date(departureUtc.toLocaleString("en-US", { timeZone: depTimezone }));

                    // 현재 시간을 출발지 현지시간으로 변환
                    const nowLocal = new Date(nowUtc.toLocaleString("en-US", { timeZone: depTimezone }));

                    // 현지 날짜 기준으로 차이 계산
                    const departureDate = new Date(departureLocal.getFullYear(), departureLocal.getMonth(), departureLocal.getDate());
                    const nowDate = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
                    const diffTime = departureDate.getTime() - nowDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        return { text: '오늘', days: 0 };
                    }
                    if (diffDays === 1) return { text: '내일', days: 1 };
                    if (diffDays > 0) return { text: `${diffDays}일 후`, days: diffDays };
                    return { text: `${diffDays}일 후`, days: diffDays };
                }
            }
        } catch (error) {
        }


        return { text: '날짜 오류', days: 0 };
    }, [flight, type, todayStr]);

    const showUpTimeStr = useMemo(() => {
        if (type !== 'next' || !flight?.showUpDateTimeUtc || !flight?.route) return null;

        try {
            const [depAirport] = flight.route ? flight.route.split('/') : ['ICN', 'ICN'];
            const cityInfo = getCityInfo(depAirport);
            const timezone = cityInfo?.timezone || 'Asia/Seoul';
            const showUpUtc = new Date(flight.showUpDateTimeUtc);
            return formatInTimeZone(showUpUtc, timezone, 'HH:mm');
        } catch (e) {
            return null;
        }
    }, [flight, type]);

    if (!flight) {
        return (
            <motion.div
                onClick={handleClick}
                className="glass-card rounded-2xl p-4 sm:p-6 text-center flex flex-col justify-center items-center h-full min-h-[120px] sm:min-h-[140px] cursor-pointer group hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <p className="text-xl font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
                    {type === 'next' ? '다음 비행 기록 없음' : type === 'nextNext' ? '그 다음 비행 기록 없음' : '과거 비행 기록 없음'}
                </p>
            </motion.div>
        );
    }

    const getAirportCode = () => {
        if (!flight) return '';

        // 최근 비행에서 베이스 공항이 표시되는 것을 방지
        if (type === 'last') {
            const code = getAirportCodeForCard(flight.route || 'ICN/ICN', type, baseIata);
            // 베이스 공항과 동일한 경우 빈 문자열 반환 (표시하지 않음)
            if (code === baseIata) {
                // 로그 제거
                return '';
            }
            return code;
        }

        // 도착 전 구간(출발은 했지만 아직 도착 전)에는 베이스 공항을 제외하고 표시


        const code = getAirportCodeForCard(flight.route || 'ICN/ICN', type, baseIata);
        return code;
    };

    const getStatusColor = () => {
        if (!ddayInfo) return 'text-slate-500';

        if (ddayInfo.days === 0) return 'text-emerald-400';
        if (ddayInfo.days > 0) return 'text-blue-400';
        if (ddayInfo.days === -1) return 'text-amber-400';
        return 'text-slate-500';
    };

    return (
        <motion.div
            onClick={handleClick}
            className="relative glass-card rounded-2xl p-4 sm:p-6 text-center flex flex-col justify-center gap-1 items-center h-full min-h-[120px] sm:min-h-[140px] cursor-pointer hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >


            <div className="flex flex-col items-center">
                <p className={`text-sm font-medium mb-1 ${type === 'next' ? 'text-blue-400' : type === 'nextNext' ? 'text-purple-400' : 'text-emerald-400'}`}>
                    {type === 'next' ? '다음 비행' : type === 'nextNext' ? '그 다음 비행' : '최근 비행'}
                </p>

                {ddayInfo && (
                    <p className={`text-4xl sm:text-4xl md:text-5xl font-bold whitespace-nowrap ${type === 'next' ? 'text-blue-400' : type === 'nextNext' ? 'text-purple-400' : 'text-emerald-400'}`}>
                        {ddayInfo.text}
                    </p>
                )}
            </div>

            <div className="flex flex-col items-center w-full">
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-1 whitespace-nowrap drop-shadow-md">
                    {getAirportCode()}
                </p>
                {type === 'last' ? (
                    <StatusBadge
                        key={`status-${flight.id}-${flight.status?.departed}-${flight.status?.landed}`}
                        status={flight.status}
                        flightNumber={flight.flightNumber}
                        isActualFlight={isActualFlight(flight)}
                        onStatusChange={onStatusChange}
                        flightId={String(flight.id)}
                        type={type}
                    />
                ) : (
                    <p className={`text-sm font-medium text-slate-400 mt-1 ${showUpTimeStr ? '' : 'invisible'}`}>
                        {showUpTimeStr ? `SHOW UP ${showUpTimeStr}` : 'SHOW UP 00:00'}
                    </p>
                )}
            </div>
        </motion.div>
    );
});

FlightCard.displayName = 'FlightCard';

export default FlightCard;