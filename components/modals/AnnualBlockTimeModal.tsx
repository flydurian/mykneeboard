import React, { useState, useEffect } from 'react';
import { Flight } from '../../types';

interface AnnualBlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  flights: Flight[];
  currentYear: number;
}

const AnnualBlockTimeModal: React.FC<AnnualBlockTimeModalProps> = ({
  isOpen,
  onClose,
  flights,
  currentYear
}) => {
  const [monthlyData, setMonthlyData] = useState<Array<{
    month: number;
    blockTime: number;
    monthName: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Firebase에서 월별 block 시간 불러오기
  useEffect(() => {
    if (!isOpen) return;

    const loadMonthlyBlocks = async () => {
      setIsLoading(true);

      try {

        // 12개월의 데이터 계산
        const monthlyData = Array.from({ length: 12 }, (_, monthIndex) => {
          const currentYearFlights = flights.filter(flight => {
            const flightDate = new Date(flight.date);
            return flightDate.getFullYear() === currentYear;
          });

          const monthFlights = currentYearFlights.filter(flight => {
            const flightDate = new Date(flight.date);
            return flightDate.getMonth() === monthIndex;
          });

          // monthlyTotalBlock 우선 사용
          const firstFlightWithMonthlyTotal = monthFlights.find(flight =>
            flight.monthlyTotalBlock && flight.monthlyTotalBlock !== '00:00'
          );

          let blockTime = 0;
          if (firstFlightWithMonthlyTotal && firstFlightWithMonthlyTotal.monthlyTotalBlock) {
            // monthlyTotalBlock이 HH:MM 형식이므로 분으로 변환
            const timeParts = firstFlightWithMonthlyTotal.monthlyTotalBlock.split(':');
            if (timeParts.length === 2) {
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              blockTime = hours * 60 + minutes;
            }
          } else {
            // 개별 비행의 block 시간 합산
            blockTime = monthFlights.reduce((total, flight) => {
              if (flight.block && flight.block > 0) {
                return total + flight.block;
              }
              return total;
            }, 0);
          }

          return {
            month: monthIndex,
            blockTime,
            monthName: `${monthIndex + 1}월`,
            source: 'Flight Data'
          };
        });

        setMonthlyData(monthlyData);
      } catch (error) {
        console.error('연간 비행시간 모달: 월별 block 시간 계산 오류:', error);
        setMonthlyData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMonthlyBlocks();
  }, [isOpen, currentYear, flights]);

  if (!isOpen) return null;

  // 누적 시간 계산
  let cumulativeTime = 0;
  const cumulativeData = monthlyData.map(data => {
    cumulativeTime += data.blockTime;
    return {
      ...data,
      cumulativeTime
    };
  });

  // 최대값 계산 (그래프 스케일링용)
  const maxBlockTime = Math.max(...monthlyData.map(d => d.blockTime), 100);
  const maxCumulativeTime = Math.max(...cumulativeData.map(d => d.cumulativeTime), 1000);

  // SVG 그래프 생성 (반응형 크기)
  const createGraph = () => {
    // 화면 크기에 따른 그래프 크기 조정
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    const isDesktop = window.innerWidth >= 1024;

    let width, height, padding, rightPadding;

    if (isDesktop) {
      // 데스크톱: 더 넓은 그래프
      width = 160;
      height = 110;
      padding = 12;
      rightPadding = 16;
    } else if (isTablet) {
      // 테블릿: 중간 크기 그래프
      width = 140;
      height = 100;
      padding = 11;
      rightPadding = 14;
    } else {
      // 모바일: 기본 크기
      width = 120;
      height = 95;
      padding = 10;
      rightPadding = 13;
    }

    const chartWidth = width - padding - rightPadding;
    const chartHeight = height - padding * 2;

    // 월별 블록 시간 선 그래프 (그라데이션 영역 포함) - 100시간 기준
    const monthlyLinePoints = monthlyData.map((data, index) => {
      const x = padding + (index * chartWidth / 12) + (chartWidth / 12 / 2);
      const y = padding + chartHeight - (data.blockTime / (100 * 60)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // 그라데이션 영역을 위한 패스 생성 - 100시간 기준
    const areaPath = monthlyData.map((data, index) => {
      const x = padding + (index * chartWidth / 12) + (chartWidth / 12 / 2);
      const blockTime = isNaN(data.blockTime) ? 0 : data.blockTime;
      const y = padding + chartHeight - (blockTime / (100 * 60)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    const areaPathWithBottom = areaPath ? `${areaPath} L${padding + chartWidth - (chartWidth / 12 / 2)},${padding + chartHeight} L${padding + (chartWidth / 12 / 2)},${padding + chartHeight} Z` : '';

    // 월별 블록 시간 포인트 (더 큰 원형) - 100시간 기준
    const monthlyPoints = monthlyData.map((data, index) => {
      const x = padding + (index * chartWidth / 12) + (chartWidth / 12 / 2);
      const y = padding + chartHeight - (data.blockTime / (100 * 60)) * chartHeight;
      return (
        <circle
          key={`monthly-point-${index}`}
          cx={x}
          cy={y}
          r={1.2}
          fill="#8B5CF6"
          className="fill-purple-400"
          stroke="white"
          strokeWidth={0.3}
        />
      );
    });

    // 누적 시간 막대 그래프 - 1000시간 기준
    const cumulativeBars = cumulativeData.map((data, index) => {
      const barHeight = (data.cumulativeTime / (1000 * 60)) * chartHeight;
      const x = padding + (index * chartWidth / 12) + (chartWidth / 12 / 2) - 2.5;
      const y = padding + chartHeight - barHeight;

      return (
        <rect
          key={`cumulative-bar-${index}`}
          x={x}
          y={y}
          width={5}
          height={barHeight}
          fill="url(#barGradient)"
          rx={1}
          ry={1}
        />
      );
    });

    // 1000시간 LIMIT 라인 (분 단위로 변환: 1000시간 = 60000분) - 1000시간 기준
    const limitY = padding + chartHeight - (60000 / (1000 * 60)) * chartHeight;
    const limitLine = (
      <line
        x1={padding}
        y1={limitY}
        x2={padding + chartWidth}
        y2={limitY}
        stroke="#EF4444"
        strokeWidth={0.4}
        strokeDasharray="0.8,0.8"
      />
    );

    // LIMIT 텍스트
    const limitText = (
      <text
        x={padding + chartWidth - 1}
        y={limitY - 0.5}
        fill="#EF4444"
        fontSize="3.4"
        fontWeight="bold"
        textAnchor="end"
      >
        LIMIT
      </text>
    );

    // Y축 라벨 (월별 블록 시간) - 100시간까지
    const leftYLabels = Array.from({ length: 6 }, (_, i) => {
      const value = (100 * 60 / 5) * i; // 100시간을 분으로 변환하여 5등분
      const y = padding + chartHeight - (value / (100 * 60)) * chartHeight;
      return (
        <text
          key={`left-y-${i}`}
          x={padding - 1}
          y={y + 1.2}
          fill="#94a3b8"
          className="fill-slate-400"
          fontSize="3.4"
          fontWeight="500"
          textAnchor="end"
        >
          {Math.round(value / 60)}h
        </text>
      );
    });

    // Y축 라벨 (누적 시간) - 1000시간까지
    const rightYLabels = Array.from({ length: 6 }, (_, i) => {
      const value = (1000 * 60 / 5) * i; // 1000시간을 분으로 변환하여 5등분
      const y = padding + chartHeight - (value / (1000 * 60)) * chartHeight;
      return (
        <text
          key={`right-y-${i}`}
          x={padding + chartWidth + 2}
          y={y + 1.2}
          fill="#94a3b8"
          className="fill-slate-400"
          fontSize="3.4"
          fontWeight="500"
          textAnchor="start"
        >
          {Math.round(value / 60)}h
        </text>
      );
    });

    // X축 라벨 (월) - 그래프와 간격을 벌려서 가독성 개선
    const xLabels = monthlyData.map((data, index) => {
      const x = padding + (index * chartWidth / 12) + (chartWidth / 12 / 2);
      return (
        <text
          key={`x-${index}`}
          x={x}
          y={padding + chartHeight + 8}
          fill="#94a3b8"
          className="fill-slate-400"
          fontSize="3.8"
          fontWeight="500"
          textAnchor="middle"
        >
          {data.monthName}
        </text>
      );
    });

    // 격자선
    const gridLines = Array.from({ length: 6 }, (_, i) => {
      const y = padding + (chartHeight / 5) * i;
      return (
        <line
          key={`grid-${i}`}
          x1={padding}
          y1={y}
          x2={padding + chartWidth}
          y2={y}
          stroke="#334155"
          className="stroke-slate-700"
          strokeWidth={0.2}
        />
      );
    });

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 그라데이션 정의 */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* 배경 제거 */}

        {/* 격자선 */}
        {gridLines}

        {/* Y축 라벨 (왼쪽 - 월별 블록 시간) */}
        {leftYLabels}

        {/* Y축 라벨 (오른쪽 - 누적 시간) */}
        {rightYLabels}

        {/* X축 라벨 */}
        {xLabels}

        {/* 누적 시간 막대 */}
        {cumulativeBars}

        {/* 월별 블록 시간 그라데이션 영역 */}
        {areaPathWithBottom && (
          <path
            d={`M${areaPathWithBottom}`}
            fill="url(#areaGradient)"
          />
        )}

        {/* 월별 블록 시간 선 (그라데이션) */}
        <polyline
          points={monthlyLinePoints}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 월별 블록 시간 포인트 */}
        {monthlyPoints}

        {/* 1000시간 LIMIT 라인 */}
        {limitLine}
        {limitText}

        {/* 축 라인 */}
        <line x1={padding} y1={padding} x2={padding} y2={padding + chartHeight} stroke="#475569" className="stroke-slate-600" strokeWidth={0.3} />
        <line x1={padding} y1={padding + chartHeight} x2={padding + chartWidth} y2={padding + chartHeight} stroke="#475569" className="stroke-slate-600" strokeWidth={0.3} />
        <line x1={padding + chartWidth} y1={padding} x2={padding + chartWidth} y2={padding + chartHeight} stroke="#475569" className="stroke-slate-600" strokeWidth={0.3} />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-0.5 sm:px-1 py-1 sm:py-2 pt-12 sm:pt-16 pt-safe" onClick={onClose}>
      <div className="glass-panel rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">
            {currentYear}년 연간 비행시간
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 그래프 */}
        <div className="p-3 pb-2">
          <div className="mb-3">
            <div className="flex items-center justify-end gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-slate-400">월 시간</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 opacity-70"></div>
                <span className="text-slate-400">누적 시간</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-red-500 border-dashed border-t-2"></div>
                <span className="text-slate-400">1000시간 LIMIT</span>
              </div>
            </div>
          </div>

          <div className="p-1 sm:p-2">
            <div className="w-full h-[300px] sm:h-[340px] md:h-[380px] lg:h-[420px] overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    <p className="text-slate-400">월별 비행시간 불러오는 중...</p>
                  </div>
                </div>
              ) : (
                createGraph()
              )}
            </div>
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="px-3 pb-4 pt-2 border-t border-white/10">
          <div className="flex flex-row justify-between items-center gap-1 md:gap-2 text-xs md:text-base">
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-slate-400">최대:</span>
              <span className="font-bold text-white text-sm md:text-lg">
                {Math.round(Math.max(...monthlyData.map(d => d.blockTime)) / 60)}시간
              </span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-slate-400">총계:</span>
              <span className="font-bold text-white text-sm md:text-lg">
                {Math.round((cumulativeData[cumulativeData.length - 1]?.cumulativeTime || 0) / 60)}시간
              </span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-slate-400">LIMIT까지:</span>
              <span className="font-bold text-white text-sm md:text-lg">
                {Math.max(0, 1000 - Math.round((cumulativeData[cumulativeData.length - 1]?.cumulativeTime || 0) / 60))}시간
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualBlockTimeModal;
