import React from 'react';
import { CurrencyModalData, Flight } from '../../types';
import { XIcon } from '../icons';
import { isActualFlight } from '../../utils/helpers';

interface CurrencyDetailModalProps {
    data: CurrencyModalData | null;
    onClose: () => void;
    onFlightClick: (flight: Flight) => void;
}

const CurrencyDetailModal: React.FC<CurrencyDetailModalProps> = ({ data, onClose, onFlightClick }) => {
    if (!data) return null;

    // 월별 횟수 계산 (이륙/착륙 구분) - 6개월 데이터 사용
    const calculateMonthlyData = () => {
        const monthlyCount: { [key: string]: number } = {};
        
        // graphEvents가 있으면 사용, 없으면 events 사용 (호환성)
        const eventsToUse = data.graphEvents || data.events;
        
        eventsToUse.forEach(event => {
            // 이륙 이력에는 이륙만, 착륙 이력에는 착륙만 포함
            const isTakeoffModal = data.title === '이륙';
            const shouldInclude = isTakeoffModal ? event.status.departed : event.status.landed;
            
            if (shouldInclude) {
                const date = new Date(event.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
            }
        });

        // 최근 6개월 데이터만 가져오기
        const last6Months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            last6Months.push({
                month: monthKey,
                count: monthlyCount[monthKey] || 0,
                displayMonth: `${date.getMonth() + 1}월`
            });
        }

        return last6Months;
    };

    const monthlyData = calculateMonthlyData();
    const maxCount = Math.max(...monthlyData.map(d => d.count), 1);

    // 선형 그래프 생성
    const createLineChart = () => {
        const width = 300;
        const height = 140;
        const padding = 30;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        if (monthlyData.length === 0) return null;

        // 점들의 좌표 계산
        const points = monthlyData.map((data, index) => {
            const x = padding + (index * chartWidth) / (monthlyData.length - 1);
            const y = padding + chartHeight - (data.count / maxCount) * chartHeight;
            return { x, y, count: data.count };
        });

        // 선 경로 생성
        const pathData = points.map((point, index) => 
            `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');

        // 영역 채우기 경로 생성
        const areaPath = `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

        return (
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">월별횟수(최근6개월)</h3>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{data.title}</span>
                    </div>
                </div>
                
                <div className="relative">
                    <svg width={width} height={height} className="mx-auto drop-shadow-sm">
                        {/* 그라데이션 정의 */}
                        <defs>
                            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3B82F6" />
                                <stop offset="50%" stopColor="#8B5CF6" />
                                <stop offset="100%" stopColor="#EC4899" />
                            </linearGradient>
                            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                            </linearGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>

                        {/* 배경 그리드 */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <line
                                key={i}
                                x1={padding}
                                y1={padding + (i * chartHeight) / 4}
                                x2={width - padding}
                                y2={padding + (i * chartHeight) / 4}
                                stroke="currentColor"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                                className="text-gray-200 dark:text-gray-700"
                            />
                        ))}
                        
                        {/* 영역 채우기 */}
                        <path
                            d={areaPath}
                            fill="url(#areaGradient)"
                        />
                        
                        {/* 선 그래프 */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#glow)"
                        />
                        
                        {/* 점들 */}
                        {points.map((point, index) => (
                            <g key={index}>
                                {/* 메인 점 */}
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r="5"
                                    fill="white"
                                    stroke="url(#lineGradient)"
                                    strokeWidth="2"
                                    className="drop-shadow-md"
                                />
                                {/* 내부 점 */}
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r="2"
                                    fill="url(#lineGradient)"
                                />
                                {/* 횟수 표시 */}
                                <text
                                    x={point.x}
                                    y={point.y - 12}
                                    textAnchor="middle"
                                    className="text-xs font-semibold fill-current text-gray-700 dark:text-gray-200"
                                >
                                    {point.count}
                                </text>
                            </g>
                        ))}
                        
                        {/* X축 라벨 */}
                        {monthlyData.map((data, index) => (
                            <text
                                key={index}
                                x={padding + (index * chartWidth) / (monthlyData.length - 1)}
                                y={height - 8}
                                textAnchor="middle"
                                className="text-xs font-medium fill-current text-gray-500 dark:text-gray-400"
                            >
                                {data.displayMonth}
                            </text>
                        ))}
                    </svg>
                    
                    {/* 통계 정보 */}
                    <div className="mt-3 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>최대: {maxCount}회</span>
                        <span>총계: {monthlyData.reduce((sum, d) => sum + d.count, 0)}회</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{data.title} 최근 이력</h2>
                
                {/* 디버깅 로그 */}
                
                {data.events.length > 0 ? (
                    <>
                        {/* 월별 그래프 */}
                        {createLineChart()}
                        
                        {/* 최근 이력 목록 */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">최근 기록</h3>
                            <ul className="space-y-2">
                                {data.events
                                    .sort((a, b) => {
                                        // 먼저 날짜로 정렬 (최신 날짜가 위로)
                                        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                                        if (dateCompare !== 0) return dateCompare;
                                        
                                        // 같은 날짜인 경우 출발 시간으로 정렬 (최신 시간이 위로)
                                        if (a.departureDateTimeUtc && b.departureDateTimeUtc) {
                                            return new Date(b.departureDateTimeUtc).getTime() - new Date(a.departureDateTimeUtc).getTime();
                                        }
                                        
                                        // 출발 시간이 없는 경우 편명으로 정렬 (숫자가 큰 편명이 위로)
                                        const aFlightNum = parseInt(a.flightNumber.replace(/\D/g, '')) || 0;
                                        const bFlightNum = parseInt(b.flightNumber.replace(/\D/g, '')) || 0;
                                        return bFlightNum - aFlightNum;
                                    })
                                    .slice(0, 3)
                                    .map(event => (
                                    <li 
                                        key={event.id} 
                                        className="p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                                        onClick={() => onFlightClick(event)}
                                    >
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{event.date}</p>
                                        <p className="text-base text-gray-600 dark:text-gray-400">
                                            {event.flightNumber}편: {
                                                event.route 
                                                    ? event.route.replace('/', ' → ')
                                                    : isActualFlight(event)
                                                        ? '노선 정보 없음'
                                                        : event.flightNumber
                                            }
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">최근 90일 내 기록이 없습니다.</p>
                )}
            </div>
        </div>
    );
};

export default CurrencyDetailModal;