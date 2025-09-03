import React, { useState, useEffect, useMemo, useRef, memo, useCallback, useReducer } from 'react';

// --- 타입 정의 ---
interface TimelineSegment {
    label: string;
    duration: number; // 분 단위
    color: string;
    showRemaining?: boolean; // 남은 시간 표시 여부
}

interface TimePoint {
    label: string;
    zulu: string;
    local: string;
    korea: string;
}

// --- Custom CSS for Scrollbar ---
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .custom-scrollbar.scrolling::-webkit-scrollbar-thumb {
    opacity: 1;
    background: rgba(255, 255, 255, 0.4);
  }
  
  .custom-scrollbar:not(.scrolling)::-webkit-scrollbar-thumb {
    opacity: 0;
  }
`;

// --- Constants ---
const TABS = [
    { id: '2set', label: '2SET' },
    { id: '3pilot', label: '3PILOT' },
];
const TWO_SET_MODES = [
    { id: '2교대', label: '2SET 2교대' },
    { id: '1교대', label: '2SET 1교대' },
];

const THREE_PILOT_CASES = [
    { id: 'CASE1' },
    { id: 'CASE2' },
];

// --- Utility Functions ---
const timeToMinutes = (timeString: string) => {
    if (!timeString) return 0;
    const padded = timeString.padStart(4, '0');
    const hours = parseInt(padded.slice(0, 2), 10) || 0;
    const minutes = parseInt(padded.slice(2, 4), 10) || 0;
    return hours * 60 + minutes;
};

const minutesToHHMM = (totalMinutes: number) => {
    if (totalMinutes < 0) totalMinutes = 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
};

const minutesToKoreanDisplay = (totalMinutes: number) => {
    if (!totalMinutes) return '0분';
    if (totalMinutes < 0) return `${minutesToKoreanDisplay(Math.abs(totalMinutes))}`
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
    if (hours > 0) return `${hours}시간`;
    return `${minutes}분`;
};

const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '00:00';
    const padded = timeString.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
};

const convertTime = (utcTimeMinutes: number, offsetHours: number) => {
    let totalMinutes = utcTimeMinutes + offsetHours * 60;
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    return minutesToHHMM(totalMinutes);
};

// Zulu 시간도 24시간 제한 적용
const convertZuluTime = (utcTimeMinutes: number) => {
    let totalMinutes = utcTimeMinutes;
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    return minutesToHHMM(totalMinutes);
};

const minutesToHhMm = (totalMinutes: number) => {
    if (totalMinutes < 0) totalMinutes = 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours > 0 && minutes > 0) return `${hours}h${String(minutes).padStart(2, '0')}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
};

// --- Timezone Utility Functions ---


// --- Icon Components ---
const CalculatorIcon = memo((props: any) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect width="16" height="20" x="4" y="2" rx="2"/>
    <line x1="8" x2="16" y1="6" y2="6"/>
    <line x1="16" x2="16" y1="14" y2="18"/>
    <line x1="16" x2="16" y1="10" y2="10"/>
    <line x1="10" x2="10" y1="10" y2="18"/>
  </svg>
));

const ClockIcon = memo((props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
));

const PlaneIcon = memo((props: any) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1.5-1.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </svg>
));

// --- UI Components ---
const DisplayInput = memo(({ label, value, onClick, warning, isDark }: { label: string; value: string; onClick: () => void; warning?: string; isDark: boolean }) => (
  <div>
    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{label}</label>
    <div
      className={`w-full px-3 py-2 border rounded-lg text-center font-mono text-lg cursor-pointer flex items-center justify-center min-h-[44px] ${
        isDark 
          ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-100' 
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900'
      } ${warning ? 'border-red-500' : ''}`}
      onClick={onClick}
      role="button"
    >
      {value}
    </div>
    {warning && <p className="text-xs text-red-500 mt-1 text-center">{warning}</p>}
  </div>
));

const ReadOnlyDisplay = memo(({ label, value, isDark }: { label: string; value: string; isDark: boolean }) => (
    <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{label}</label>
        <div
            className={`w-full px-3 py-2 border rounded-lg text-center font-mono text-lg flex items-center justify-center min-h-[44px] cursor-not-allowed ${
                isDark 
                    ? 'bg-gray-900/50 border-gray-700 text-gray-400' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}
        >
            {value}
        </div>
    </div>
));

// 헬퍼 함수: 분을 '시간 분'으로 변환 (0시간일 때는 시간 표시 안함)
const minutesToDisplayFormat = (totalMinutes: number): string => {
    if (totalMinutes <= 0 || totalMinutes === undefined || totalMinutes === null) return '0h00m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours === 0) {
        return `${minutes}m`;  // 시간이 0일 때는 분만 표시
    } else if (minutes === 0) {
        return `${hours}h`;    // 분이 0일 때는 시간만 표시
    } else {
        return `${hours}h${String(minutes).padStart(2, '0')}m`;  // 시간과 분이 모두 있을 때
    }
};

// --- FlightTimeline Component ---
const FlightTimeline = memo(({ 
    segments, 
    timePoints, 
    progress = 0, 
    isDark 
}: { 
    segments: TimelineSegment[]; 
    timePoints: TimePoint[]; 
    progress?: number; 
    isDark: boolean; 
}) => {
    const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0);

    // totalDuration이 0이면 빈 타임라인 표시
    if (totalDuration <= 0) {
        return (
            <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'} text-white font-sans w-full`}>
                <div className="text-center text-gray-400">
                    비행 시간을 입력해주세요
                </div>
            </div>
        );
    }

    return (
        <div className={`px-1 py-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'} text-white font-sans w-full`}>
            <div className="relative h-12">
                <div className="w-full h-8 bg-gray-700 rounded-full flex overflow-hidden shadow-inner animate-breathing border-2 border-blue-400/50">
                    {segments.map((segment, index) => {
                        const cumulativeDurationBefore = segments.slice(0, index).reduce((acc, s) => acc + s.duration, 0);
                        const elapsedTotalMinutes = progress * totalDuration;
                        
                        let minutesToShow;
                        const isFlightCompleted = progress >= 1; // 비행이 완전히 종료되었는지 확인
                        
                        if (isFlightCompleted) {
                            // 비행이 완전히 종료되면 각 구간의 전체 시간을 다시 표시
                            minutesToShow = segment.duration;
                        } else if (elapsedTotalMinutes < cumulativeDurationBefore) {
                            minutesToShow = segment.duration;
                        } else if (elapsedTotalMinutes >= cumulativeDurationBefore + segment.duration) {
                            minutesToShow = 0;
                        } else {
                            minutesToShow = (cumulativeDurationBefore + segment.duration) - elapsedTotalMinutes;
                        }

                        const isCompleted = elapsedTotalMinutes >= (cumulativeDurationBefore + segment.duration);

                        return (
                            <div
                                key={index}
                                className={`${segment.color} h-full relative flex items-center justify-center shrink-0 transition-opacity duration-500 ${isCompleted && !isFlightCompleted ? 'opacity-30' : 'opacity-100'}`}
                                style={{ width: `${(segment.duration / totalDuration) * 100}%` }}
                            >
                                <span 
                                    className={`text-white font-bold z-10 ${(segment.duration / totalDuration) * 100 < 15 ? 'text-xs' : (segment.duration / totalDuration) * 100 < 25 ? 'text-sm' : 'text-base'} sm:text-sm md:text-base`}
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                                >
                                    {minutesToDisplayFormat(minutesToShow)}
                                </span>
                            </div>
                        );
                    })}
                </div>


            </div>

            {/* 시간 표시 지점 */}
            <div className={`relative mt-2 h-20 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {timePoints.map((point, index) => {
                    // 시간 포인트 위치 계산 - 각 세그먼트의 종료 부분과 연동
                    let position = 0;
                    if (index === 0) {
                        // 첫 번째 포인트 (이륙 후 종료) - 첫 번째 세그먼트의 끝
                        position = (segments[0].duration / totalDuration) * 100;
                    } else if (index === 1) {
                        // 두 번째 포인트 (CRZ1 종료) - 첫 번째 + 두 번째 세그먼트의 끝
                        const cumulativeDuration = segments.slice(0, 2).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    } else if (index === 2) {
                        // 세 번째 포인트 (MID 종료) - 첫 번째 + 두 번째 + 세 번째 세그먼트의 끝
                        const cumulativeDuration = segments.slice(0, 3).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    } else if (index === 3) {
                        // 네 번째 포인트 (CRZ2 종료) - 첫 번째 + 두 번째 + 세 번째 + 네 번째 세그먼트의 끝
                        const cumulativeDuration = segments.slice(0, 4).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    }
                    
                    // ✨ [핵심 수정] 하이라이트 로직 변경
                    const isHighlighted = (() => {
                        if (segments.length === 0 || totalDuration === 0) return false;

                        // 각 세그먼트의 시작과 끝 진행률을 계산
                        const cumulativeDuration = segments.slice(0, index).reduce((acc, s) => acc + s.duration, 0);
                        const segmentStartProgress = cumulativeDuration / totalDuration;
                        const segmentEndProgress = (cumulativeDuration + segments[index].duration) / totalDuration;

                        // progress가 0일 때, 첫 번째 타임포인트(index 0)가 하이라이트되도록 처리
                        if (progress === 0 && index === 0) {
                            return true;
                        }

                        // 현재 진행률이 해당 세그먼트의 범위 내에 있는지 확인
                        // (단, 시작 지점은 포함하지 않아 이전 세그먼트와 겹치지 않도록 함)
                        return progress > segmentStartProgress && progress <= segmentEndProgress;
                    })();

                    return (
                        <div
                            key={index}
                            className="absolute -translate-x-1/2"
                            style={{ left: `${position}%` }}
                        >
                            {/* 모든 타임표에 동일한 세로선 표시 */}
                            <div className={`w-px h-2 mx-auto ${isHighlighted ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`}></div>
                            <div 
                                className={`mt-2 p-2 rounded-md text-center whitespace-nowrap border-2 ${isHighlighted ? (isDark ? 'border-white' : 'border-black') + ' shadow-lg' : 'border-transparent'}`}
                                style={isHighlighted ? {
                                    boxShadow: isDark 
                                        ? '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 255, 255, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)'
                                        : '0 0 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 0, 0, 0.2)'
                                } : {}}
                            >
                                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{point.zulu}</p>
                                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{point.local}</p>
                                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{point.korea}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// --- Main Application ---
const defaultState = {
    activeTab: '2set',
    twoSetMode: '2교대',
    flightTime: '1420',
    flightTime3Pilot: '1420',
    departureTime: '0200',
    crz1Time: '0330',
    afterTakeoff: '0200',
    afterTakeoff1교대: '0200',
    afterTakeoff3Pilot: '0100',
    beforeLanding: '0100',
    beforeLanding1교대: '0100',
    timeZone: -4,
    threePilotCase: 'CASE1',
};

const loadInitialState = (initialState: any) => {
    try {
        const savedStateJSON = localStorage.getItem('pilotRestCalculatorState');
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            delete savedState.activeAlarms;
            return { ...initialState, ...savedState };
        }
    } catch (e) {
        console.error("Failed to parse state from localStorage. Using default state.", e);
    }
    return initialState;
};

const reducer = (state: any, action: any) => {
    switch (action.type) {
        case 'UPDATE_STATE':
            return { ...state, ...action.payload };
        case 'SET_TIME': {
            const numbers = action.payload.value.replace(/\D/g, '').slice(0, 4);
            return { ...state, [action.payload.field]: numbers };
        }
        case 'ADJUST_FLIGHT_TIME_3PILOT': {
            if (state.activeTab !== '3pilot') return state;
            const currentMinutes = timeToMinutes(state.flightTime3Pilot);
            if (currentMinutes === 0 || currentMinutes % 3 === 0) return state;
            const roundedMinutes = Math.ceil(currentMinutes / 3) * 3;
            return { ...state, flightTime3Pilot: minutesToHHMM(roundedMinutes) };
        }
        default:
            return state;
    }
};

const RestCalculator: React.FC<{ isDark: boolean }> = ({ isDark }) => {
    const [state, dispatch] = useReducer(reducer, defaultState, loadInitialState);
    const { activeTab, twoSetMode, flightTime, flightTime3Pilot, departureTime, crz1Time, afterTakeoff, afterTakeoff1교대, afterTakeoff3Pilot, beforeLanding, beforeLanding1교대, timeZone, threePilotCase } = state;


    const [currentTime, setCurrentTime] = useState(new Date());
    const [showTimeline, setShowTimeline] = useState(true);
    const [showTimeZonePicker, setShowTimeZonePicker] = useState(false);
    const [showCrz1Picker, setShowCrz1Picker] = useState(false);
    const [showAfterTakeoffPicker, setShowAfterTakeoffPicker] = useState(false);
    const [showBeforeLandingPicker, setShowBeforeLandingPicker] = useState(false);
    
    const timeZonePickerRef = useRef<HTMLDivElement>(null);
    const crz1PickerRef = useRef<HTMLDivElement>(null);
    const afterTakeoffPickerRef = useRef<HTMLDivElement>(null);
    const beforeLandingPickerRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<NodeJS.Timeout | null>(null);
    const isCrz1Scrolling = useRef<NodeJS.Timeout | null>(null);
    const isAfterTakeoffScrolling = useRef<NodeJS.Timeout | null>(null);
    const isBeforeLandingScrolling = useRef<NodeJS.Timeout | null>(null);
    const [currentScrollValue, setCurrentScrollValue] = useState(timeZone);
    const [currentCrz1ScrollValue, setCurrentCrz1ScrollValue] = useState(crz1Time);
    const [currentAfterTakeoffScrollValue, setCurrentAfterTakeoffScrollValue] = useState(() => {
        if (activeTab === '2set' && twoSetMode === '1교대') {
            return afterTakeoff1교대;
        } else if (activeTab === '3pilot') {
            return afterTakeoff3Pilot;
        } else {
            return afterTakeoff;
        }
    });
    const [currentBeforeLandingScrollValue, setCurrentBeforeLandingScrollValue] = useState(beforeLanding);
    const [isScrollingState, setIsScrollingState] = useState(false);
    const [isCrz1ScrollingState, setIsCrz1ScrollingState] = useState(false);
    const [isAfterTakeoffScrollingState, setIsAfterTakeoffScrollingState] = useState(false);
    const [isBeforeLandingScrollingState, setIsBeforeLandingScrollingState] = useState(false);
    
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // ✨ [수정] localStorage 저장은 별도의 useEffect로 분리
    useEffect(() => {
        try {
            localStorage.setItem('pilotRestCalculatorState', JSON.stringify(state));
        } catch (e) {
            console.error("Could not save state to local storage", e);
        }
    }, [state]);

    // CSS 스타일 주입
    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.textContent = scrollbarStyles;
        document.head.appendChild(styleElement);
        
        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    const flightTimeMinutes = useMemo(() => {
        return timeToMinutes(activeTab === '3pilot' ? flightTime3Pilot : flightTime);
    }, [flightTime, flightTime3Pilot, activeTab]);

    // 2SET과 3PILOT의 비행시간을 완전히 분리
    const flightTimeMinutes2Set = useMemo(() => {
        return timeToMinutes(flightTime);
    }, [flightTime]);

    const flightTimeMinutes3Pilot = useMemo(() => {
        return timeToMinutes(flightTime3Pilot);
    }, [flightTime3Pilot]);

    // ✨ [핵심 수정] 비행시간 변경 시 CRZ1 기본값을 편조별 시간의 반으로 설정 (무한 루프 방지)
    const prevFlightTimeMinutes = useRef(flightTimeMinutes2Set);
    useEffect(() => {
        if (activeTab === '2set' && twoSetMode === '2교대' && flightTimeMinutes2Set > 0) {
            // 비행시간이 실제로 변경되었을 때만 실행
            if (prevFlightTimeMinutes.current !== flightTimeMinutes2Set) {
                const crewRestMinutes = Math.floor(flightTimeMinutes2Set / 2);
                const halfRestMinutes = crewRestMinutes / 2;
                const defaultCrz1Minutes = Math.ceil(halfRestMinutes / 5) * 5; // 5분 단위로 올림
                const currentCrz1Minutes = timeToMinutes(crz1Time);
                
                // 현재 CRZ1 값이 기본값과 다를 때만 업데이트
                if (currentCrz1Minutes !== defaultCrz1Minutes) {
                    dispatch({ type: 'UPDATE_STATE', payload: { crz1Time: minutesToHHMM(defaultCrz1Minutes) } });
                }
                prevFlightTimeMinutes.current = flightTimeMinutes2Set;
            }
        }
    }, [flightTimeMinutes2Set, activeTab, twoSetMode, crz1Time]);

    // ✨ [핵심 수정] CRZ1, CRZ2 값을 계산 (CRZ1은 사용자 입력, CRZ2는 자동 계산)
    const { crz1Minutes, crz2Minutes } = useMemo(() => {
        if (activeTab !== '2set' || twoSetMode !== '2교대' || flightTimeMinutes2Set <= 0) {
            return { crz1Minutes: 0, crz2Minutes: 0 };
        }

        // 1. 편조별 휴식 시간 계산
        const crewRestMinutes = Math.floor(flightTimeMinutes2Set / 2);

        // 2. CRZ1은 사용자 입력값 사용
        const userCrz1Minutes = timeToMinutes(crz1Time);

        // 3. CRZ2는 편조별 휴식 시간에서 CRZ1을 뺀 나머지
        const calculatedCrz2 = Math.max(0, crewRestMinutes - userCrz1Minutes);

        return { crz1Minutes: userCrz1Minutes, crz2Minutes: calculatedCrz2 };

    }, [flightTimeMinutes2Set, activeTab, twoSetMode, crz1Time]);

    const departureMinutesUTC = useMemo(() => timeToMinutes(departureTime), [departureTime]);

    // ✨ [핵심 수정] generateTimelineData에서 timelineProgress 의존성 제거
    const generateTimelineData = useMemo(() => {
        // 이 함수는 이제 순수하게 입력값에 따라 기본 세그먼트와 타임포인트만 생성합니다.
        // 남은 시간을 계산하는 로직은 여기서 완전히 제거합니다.
        
        if (activeTab === '2set' && twoSetMode === '2교대') {
            const afterTakeoffMinutes = timeToMinutes(afterTakeoff);
            const beforeLandingMinutes = timeToMinutes(beforeLanding);
            
            // 입력값 검증 및 수정
            const validAfterTakeoffMinutes = afterTakeoffMinutes > 0 ? afterTakeoffMinutes : 0;
            const validBeforeLandingMinutes = beforeLandingMinutes > 0 ? beforeLandingMinutes : 0;
            const validCrz1Minutes = crz1Minutes > 0 ? crz1Minutes : 0;
            const validCrz2Minutes = crz2Minutes > 0 ? crz2Minutes : 0;
            
            const midCrzMinutes = Math.max(0, flightTimeMinutes2Set - validAfterTakeoffMinutes - validCrz1Minutes - validCrz2Minutes - validBeforeLandingMinutes);

            const segments: TimelineSegment[] = [
                { label: '이륙 후', duration: validAfterTakeoffMinutes, color: 'bg-blue-500' },
                { label: 'CRZ 1', duration: validCrz1Minutes, color: 'bg-teal-700' },
                { label: 'MID', duration: midCrzMinutes, color: 'bg-orange-500' },
                { label: 'CRZ 2', duration: validCrz2Minutes, color: 'bg-cyan-500' },
                { label: '착륙 전', duration: validBeforeLandingMinutes, color: 'bg-lime-500' },
            ];

            // 시간 포인트 계산 (출발, 종료 시간 제외)
            const timePoints: TimePoint[] = [];
            let currentTime = departureMinutesUTC;
            
            // 이륙 후
            currentTime += validAfterTakeoffMinutes;
            timePoints.push({
                label: '이륙 후',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            // CRZ 1 후
            currentTime += validCrz1Minutes;
            timePoints.push({
                label: 'CRZ 1',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            // MID 후
            currentTime += midCrzMinutes;
            timePoints.push({
                label: 'MID',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            // CRZ 2 후
            currentTime += validCrz2Minutes;
            timePoints.push({
                label: 'CRZ 2',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            return { segments, timePoints };
        } else if (activeTab === '2set' && twoSetMode === '1교대') {
            const afterTakeoffMinutes = timeToMinutes(afterTakeoff1교대);
            const restPerCrew = Math.floor(flightTimeMinutes2Set / 2);
            const beforeLandingMinutes = Math.max(0, restPerCrew - afterTakeoffMinutes);
            const crzDuration = flightTimeMinutes2Set - afterTakeoffMinutes - beforeLandingMinutes;
            
            // 입력값 검증 및 수정
            const validAfterTakeoffMinutes = afterTakeoffMinutes > 0 ? afterTakeoffMinutes : 0;
            const validBeforeLandingMinutes = beforeLandingMinutes > 0 ? beforeLandingMinutes : 0;
            const validCrzDuration = Math.max(0, crzDuration);

            const segments: TimelineSegment[] = [
                { label: '이륙 후', duration: validAfterTakeoffMinutes, color: 'bg-blue-500' },
                { label: 'CRZ', duration: validCrzDuration, color: 'bg-teal-700' },
                { label: '착륙 전', duration: validBeforeLandingMinutes, color: 'bg-lime-500' },
            ];

            // 시간 포인트 계산 (출발, 종료 시간 제외)
            const timePoints: TimePoint[] = [];
            let currentTime = departureMinutesUTC;
            
            // 이륙 후
            currentTime += validAfterTakeoffMinutes;
            timePoints.push({
                label: '이륙 후',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            // CRZ 후
            currentTime += validCrzDuration;
            timePoints.push({
                label: 'CRZ',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            return { segments, timePoints };
        }

        return { segments: [], timePoints: [] };

    }, [activeTab, twoSetMode, flightTimeMinutes, afterTakeoff, afterTakeoff1교대, afterTakeoff3Pilot, beforeLanding, beforeLanding1교대, crz1Time, departureTime, timeZone, crz1Minutes, crz2Minutes]);

    // 3PILOT 모드에서 각 타임라인을 다르게 생성하는 함수들
    const generatePICTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };
        
        const afterTakeoffMinutes = timeToMinutes(afterTakeoff3Pilot);
        const picRestMinutes = Math.floor(flightTimeMinutes3Pilot / 3); // 총 비행시간을 3으로 나눈 값
        const remainingMinutes = Math.max(0, flightTimeMinutes3Pilot - afterTakeoffMinutes - picRestMinutes);
        
        const segments: TimelineSegment[] = [
            { label: '이륙 후 + 휴식', duration: afterTakeoffMinutes + picRestMinutes, color: 'bg-blue-500' },
            { label: '휴식', duration: picRestMinutes, color: 'bg-orange-500' },
            { label: '세번째', duration: Math.max(0, flightTimeMinutes - (afterTakeoffMinutes + picRestMinutes) - picRestMinutes), color: 'bg-blue-500' },
        ];

        const timePoints: TimePoint[] = [];
        let currentTime = departureMinutesUTC;
        
        // 첫 번째 세그먼트 끝 (이륙 후 + 휴식)
        currentTime += afterTakeoffMinutes + picRestMinutes;
        timePoints.push({
            label: '첫번째',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        // 두 번째 세그먼트 끝 (휴식)
        currentTime += picRestMinutes;
        timePoints.push({
            label: '두번째',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        return { segments, timePoints };
    }, [activeTab, flightTimeMinutes, afterTakeoff3Pilot, departureTime, timeZone]);

    const generateFOTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };
        
        const afterTakeoffMinutes = timeToMinutes(afterTakeoff3Pilot);
        const foRestMinutes = Math.floor(flightTimeMinutes3Pilot / 3); // 총 비행시간을 3으로 나눈 값
        const remainingMinutes = Math.max(0, flightTimeMinutes3Pilot - afterTakeoffMinutes - foRestMinutes);
        
        const segments: TimelineSegment[] = [
            { label: '이륙 후', duration: afterTakeoffMinutes, color: 'bg-blue-500' },
            { label: '휴식', duration: foRestMinutes, color: 'bg-orange-500' },
            { label: '잔여시간', duration: remainingMinutes, color: 'bg-blue-500' },
        ];

        const timePoints: TimePoint[] = [];
        let currentTime = departureMinutesUTC;
        
        // 첫 번째 세그먼트 끝 (이륙 후)
        currentTime += afterTakeoffMinutes;
        timePoints.push({
            label: '이륙 후',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        // 두 번째 세그먼트 끝 (휴식)
        currentTime += foRestMinutes;
        timePoints.push({
            label: '휴식',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        return { segments, timePoints };
    }, [activeTab, flightTimeMinutes, afterTakeoff3Pilot, departureTime, timeZone]);

    const generateCRZTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };
        
        const afterTakeoffMinutes = timeToMinutes(afterTakeoff3Pilot);
        const crewDutyMinutes = flightTimeMinutes3Pilot - Math.floor(flightTimeMinutes3Pilot / 3); // 편조별 근무 시간
        const remainingMinutes = Math.max(0, flightTimeMinutes3Pilot - afterTakeoffMinutes - crewDutyMinutes);
        
        const segments: TimelineSegment[] = [
            { label: '이륙 후', duration: afterTakeoffMinutes, color: 'bg-orange-500' },
            { label: '편조별 근무', duration: crewDutyMinutes, color: 'bg-green-500' },
            { label: '잔여시간', duration: remainingMinutes, color: 'bg-orange-500' },
        ];

        const timePoints: TimePoint[] = [];
        let currentTime = departureMinutesUTC;
        
        // 첫 번째 세그먼트 끝 (이륙 후)
        currentTime += afterTakeoffMinutes;
        timePoints.push({
            label: '이륙 후',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        // 두 번째 세그먼트 끝 (편조별 근무)
        currentTime += crewDutyMinutes;
        timePoints.push({
            label: '편조별 근무',
            zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
            local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
            korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
        });

        return { segments, timePoints };
    }, [activeTab, flightTimeMinutes, afterTakeoff3Pilot, departureTime, timeZone]);

    // 현재 진행률 계산 - 실제 시간 기반 (자정을 넘어가는 경우 고려)
    const timelineProgress = useMemo(() => {
        if (flightTimeMinutes <= 0 || flightTimeMinutes === undefined || flightTimeMinutes === null) return 0;
        
        // 현재 시간을 UTC로 변환
        const now = new Date();
        const currentUTCHours = now.getUTCHours();
        const currentUTCMinutes = now.getUTCMinutes();
        let currentUTCMinutesTotal = currentUTCHours * 60 + currentUTCMinutes;
        
        // 비행 시작 시간 (UTC)
        const flightStartMinutes = departureMinutesUTC || 0;
        
        // 비행 종료 시간 (UTC)
        const flightEndMinutes = flightStartMinutes + flightTimeMinutes;
        
        // 자정을 넘어가는 경우 처리
        if (flightEndMinutes > 1440) { // 24시간(1440분)을 넘어가는 경우
            // 현재 시간이 자정 이전인지 이후인지 확인
            if (currentUTCMinutesTotal < flightStartMinutes) {
                // 자정을 넘어간 경우: 현재 시간에 1440분(24시간) 추가
                currentUTCMinutesTotal += 1440;
            }
        }
        
        // 현재 시간이 비행 시간 범위 내에 있는지 확인
        if (currentUTCMinutesTotal < flightStartMinutes) {
            return 0; // 비행 시작 전
        } else if (currentUTCMinutesTotal > flightEndMinutes) {
            return 1; // 비행 종료 후
        } else {
            // 비행 중 - 진행률 계산
            const elapsedMinutes = currentUTCMinutesTotal - flightStartMinutes;
            return Math.min(1, Math.max(0, elapsedMinutes / flightTimeMinutes));
        }
    }, [flightTimeMinutes, departureMinutesUTC, currentTime]);

    const handleTimeInputChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'SET_TIME', payload: { field, value: e.target.value } });
    }, [dispatch]); // ✨ dispatch 함수는 항상 동일하므로 이렇게만 해도 충분합니다.

    const handleScroll = useCallback(() => {
        if (timeZonePickerRef.current) {
            const scrollTop = timeZonePickerRef.current.scrollTop;
            const itemHeight = 48; // h-12
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋

            // 중앙을 기준으로 선택된 인덱스 계산
            const adjustedScrollTop = scrollTop + centerOffset;
            const selectedIndex = Math.round(adjustedScrollTop / itemHeight);
            
            const UTC_OFFSETS = Array.from({ length: 26 }, (_, i) => i - 11);
            const padding = 2; // 위아래 여백
            const actualIndex = selectedIndex - padding;
            const newValue = UTC_OFFSETS[Math.max(0, Math.min(UTC_OFFSETS.length - 1, actualIndex))];
            
            setCurrentScrollValue(newValue);
            
            // 스크롤 중 상태 설정
            setIsScrollingState(true);
            
            clearTimeout(isScrolling.current);
            isScrolling.current = setTimeout(() => {
                // 정확한 중앙 위치로 스냅
                const targetScrollTop = (selectedIndex * itemHeight) - centerOffset;
                timeZonePickerRef.current?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                
                dispatch({ type: 'UPDATE_STATE', payload: { timeZone: newValue } });
                
                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, []);

    // CRZ1 드럼 픽커 스크롤 핸들러
    const handleCrz1Scroll = useCallback(() => {
        if (crz1PickerRef.current) {
            const scrollTop = crz1PickerRef.current.scrollTop;
            const itemHeight = 48; // h-12
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋

            // 중앙을 기준으로 선택된 인덱스 계산
            const adjustedScrollTop = scrollTop + centerOffset;
            const selectedIndex = Math.round(adjustedScrollTop / itemHeight);
            
            // CRZ1 시간 배열 생성 (1시간 00분부터 6시간 00분까지 5분 단위)
            const CRZ1_TIMES = [];
            for (let hour = 1; hour <= 6; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    CRZ1_TIMES.push(timeString);
                }
            }
            
            const padding = 2; // 위아래 여백
            const actualIndex = selectedIndex - padding;
            const newValue = CRZ1_TIMES[Math.max(0, Math.min(CRZ1_TIMES.length - 1, actualIndex))];
            
            setCurrentCrz1ScrollValue(newValue);
            
            // 스크롤 중 상태 설정
            setIsCrz1ScrollingState(true);
            
            clearTimeout(isCrz1Scrolling.current);
            isCrz1Scrolling.current = setTimeout(() => {
                // 정확한 중앙 위치로 스냅
                const targetScrollTop = (selectedIndex * itemHeight) - centerOffset;
                crz1PickerRef.current?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                
                dispatch({ type: 'UPDATE_STATE', payload: { crz1Time: newValue } });
                
                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsCrz1ScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, []);

    // 초기 스크롤 위치 설정
    useEffect(() => {
        if (showTimeZonePicker && timeZonePickerRef.current) { // 모달이 보일 때만 실행
            const UTC_OFFSETS = Array.from({ length: 26 }, (_, i) => i - 11);
            const initialIndex = UTC_OFFSETS.indexOf(timeZone);
            const itemHeight = 48;
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋
            const padding = 2;
            
            if (initialIndex !== -1) {
                const targetIndex = initialIndex + padding;
                const targetScrollTop = (targetIndex * itemHeight) - centerOffset;
                timeZonePickerRef.current.scrollTop = targetScrollTop;
                setCurrentScrollValue(timeZone);
            }
        }
    }, [showTimeZonePicker, timeZone]); // showTimeZonePicker를 의존성에 추가

    // CRZ1 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showCrz1Picker && crz1PickerRef.current) {
            // CRZ1 시간 배열 생성 (1시간 00분부터 6시간 00분까지 5분 단위)
            const CRZ1_TIMES = [];
            for (let hour = 1; hour <= 6; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    CRZ1_TIMES.push(timeString);
                }
            }
            
            const initialIndex = CRZ1_TIMES.indexOf(crz1Time);
            const itemHeight = 48;
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋
            const padding = 2;
            
            if (initialIndex !== -1) {
                const targetIndex = initialIndex + padding;
                const targetScrollTop = (targetIndex * itemHeight) - centerOffset;
                crz1PickerRef.current.scrollTop = targetScrollTop;
                setCurrentCrz1ScrollValue(crz1Time);
            }
        }
    }, [showCrz1Picker, crz1Time]);

    // 이륙 후 드럼 픽커 스크롤 핸들러
    const handleAfterTakeoffScroll = useCallback(() => {
        if (afterTakeoffPickerRef.current) {
            const scrollTop = afterTakeoffPickerRef.current.scrollTop;
            const itemHeight = 48; // h-12
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋

            // 중앙을 기준으로 선택된 인덱스 계산
            const adjustedScrollTop = scrollTop + centerOffset;
            const selectedIndex = Math.round(adjustedScrollTop / itemHeight);
            
            // 이륙 후 시간 배열 생성 (30분부터 6시간 00분까지 5분 단위)
            const AFTER_TAKEOFF_TIMES = [];
            for (let hour = 0; hour <= 6; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    AFTER_TAKEOFF_TIMES.push(timeString);
                }
            }
            
            const padding = 2; // 위아래 여백
            const actualIndex = selectedIndex - padding;
            const newValue = AFTER_TAKEOFF_TIMES[Math.max(0, Math.min(AFTER_TAKEOFF_TIMES.length - 1, actualIndex))];
            
            setCurrentAfterTakeoffScrollValue(newValue);
            
            // 스크롤 중 상태 설정
            setIsAfterTakeoffScrollingState(true);
            
            clearTimeout(isAfterTakeoffScrolling.current);
            isAfterTakeoffScrolling.current = setTimeout(() => {
                // 정확한 중앙 위치로 스냅
                const targetScrollTop = (selectedIndex * itemHeight) - centerOffset;
                afterTakeoffPickerRef.current?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                
                // 각 모드별로 적절한 필드 업데이트
                if (activeTab === '2set' && twoSetMode === '1교대') {
                    dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff1교대: newValue } });
                } else if (activeTab === '3pilot') {
                    dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff3Pilot: newValue } });
                } else {
                    dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff: newValue } });
                }
                
                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsAfterTakeoffScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, []);





    // 착륙 전 드럼 픽커 스크롤 핸들러
    const handleBeforeLandingScroll = useCallback(() => {
        if (beforeLandingPickerRef.current) {
            const scrollTop = beforeLandingPickerRef.current.scrollTop;
            const itemHeight = 48; // h-12
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋

            // 중앙을 기준으로 선택된 인덱스 계산
            const adjustedScrollTop = scrollTop + centerOffset;
            const selectedIndex = Math.round(adjustedScrollTop / itemHeight);
            
            // 착륙 전 시간 배열 생성 (30분부터 3시간 00분까지 5분 단위)
            const BEFORE_LANDING_TIMES = [];
            for (let hour = 0; hour <= 3; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    BEFORE_LANDING_TIMES.push(timeString);
                }
            }
            
            const padding = 2; // 위아래 여백
            const actualIndex = selectedIndex - padding;
            const newValue = BEFORE_LANDING_TIMES[Math.max(0, Math.min(BEFORE_LANDING_TIMES.length - 1, actualIndex))];
            
            setCurrentBeforeLandingScrollValue(newValue);
            
            // 스크롤 중 상태 설정
            setIsBeforeLandingScrollingState(true);
            
            clearTimeout(isBeforeLandingScrolling.current);
            isBeforeLandingScrolling.current = setTimeout(() => {
                // 정확한 중앙 위치로 스냅
                const targetScrollTop = (selectedIndex * itemHeight) - centerOffset;
                beforeLandingPickerRef.current?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                
                dispatch({ type: 'UPDATE_STATE', payload: { beforeLanding: newValue } });
                
                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsBeforeLandingScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, []);

    // 이륙 후 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showAfterTakeoffPicker && afterTakeoffPickerRef.current) {
            // 이륙 후 시간 배열 생성 (30분부터 6시간 00분까지 5분 단위)
            const AFTER_TAKEOFF_TIMES = [];
            for (let hour = 0; hour <= 6; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    AFTER_TAKEOFF_TIMES.push(timeString);
                }
            }
            
            // 각 모드별로 적절한 값 사용
            let currentAfterTakeoffValue;
            if (activeTab === '2set' && twoSetMode === '1교대') {
                currentAfterTakeoffValue = afterTakeoff1교대;
            } else if (activeTab === '3pilot') {
                currentAfterTakeoffValue = afterTakeoff3Pilot;
            } else {
                currentAfterTakeoffValue = afterTakeoff;
            }
            const initialIndex = AFTER_TAKEOFF_TIMES.indexOf(currentAfterTakeoffValue);
            const itemHeight = 48;
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋
            const padding = 2;
            
            if (initialIndex !== -1) {
                const targetIndex = initialIndex + padding;
                const targetScrollTop = (targetIndex * itemHeight) - centerOffset;
                afterTakeoffPickerRef.current.scrollTop = targetScrollTop;
                setCurrentAfterTakeoffScrollValue(currentAfterTakeoffValue);
            }
        }
    }, [showAfterTakeoffPicker, afterTakeoff, afterTakeoff1교대, afterTakeoff3Pilot, activeTab, twoSetMode]);





    // 착륙 전 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showBeforeLandingPicker && beforeLandingPickerRef.current) {
            // 착륙 전 시간 배열 생성 (30분부터 3시간 00분까지 5분 단위)
            const BEFORE_LANDING_TIMES = [];
            for (let hour = 0; hour <= 3; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    BEFORE_LANDING_TIMES.push(timeString);
                }
            }
            
            const initialIndex = BEFORE_LANDING_TIMES.indexOf(beforeLanding);
            const itemHeight = 48;
            const containerHeight = 128; // h-32
            const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋
            const padding = 2;
            
            if (initialIndex !== -1) {
                const targetIndex = initialIndex + padding;
                const targetScrollTop = (targetIndex * itemHeight) - centerOffset;
                beforeLandingPickerRef.current.scrollTop = targetScrollTop;
                setCurrentBeforeLandingScrollValue(beforeLanding);
            }
        }
    }, [showBeforeLandingPicker, beforeLanding]);

    return (
        <div className={`transition-colors duration-500 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            <div className="max-w-4xl mx-auto">
                {/* 타임라인 화면 */}
                <div className={`rounded-2xl shadow-lg p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-300">
                            비행 타임라인
                        </h2>
                        {flightTimeMinutes > 0 && (
                            <div className="text-right">
                                <div className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>총 비행시간</div>
                                <div className="text-2xl font-mono font-bold text-green-400">{minutesToHhMm(flightTimeMinutes)}</div>
                            </div>
                        )}
                    </div>

                    <div 
                        className={`flex justify-between items-center p-4 rounded-lg mb-4 cursor-pointer transition-colors ${
                            isDark 
                                ? 'bg-gray-700/60 hover:bg-gray-700/80' 
                                : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                        onClick={() => setShowTimeline(false)}
                    >
                        <div className="text-left text-sm font-mono">
                            <p className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>이륙</p>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTimeDisplay(departureTime)} UTC</p>
                            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatTimeDisplay(convertTime(departureMinutesUTC, timeZone))}L / {formatTimeDisplay(convertTime(departureMinutesUTC, 9))}K</p>
                        </div>

                        <div className={`text-center font-mono text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            ({timeZone >= 0 ? '+' : ''}{timeZone})
                        </div>

                        <div className="text-right text-sm font-mono">
                            <p className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>착륙</p>
                            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTimeDisplay(convertZuluTime(departureMinutesUTC + flightTimeMinutes))} UTC</p>
                            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatTimeDisplay(convertTime(departureMinutesUTC + flightTimeMinutes, timeZone))}L / {formatTimeDisplay(convertTime(departureMinutesUTC + flightTimeMinutes, 9))}K</p>
                        </div>
                    </div>

                    {activeTab === '2set' && (
                        <>
                            <div className={`flex border-b mb-6 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                {TWO_SET_MODES.map(mode => (
                                    <button key={mode.id} onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { twoSetMode: mode.id } })}
                                        className={`flex-1 text-center py-2 px-4 font-semibold -mb-px border-b-2 transition-colors duration-200 ${
                                            twoSetMode === mode.id 
                                                ? 'border-blue-500 text-blue-400' 
                                                : isDark 
                                                    ? 'border-transparent text-gray-500 hover:text-gray-300' 
                                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                                        }`}>
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                            <FlightTimeline 
                                segments={generateTimelineData.segments}
                                timePoints={generateTimelineData.timePoints}
                                progress={timelineProgress}
                                isDark={isDark}
                            />
                        </>
                    )}

                    {activeTab === '3pilot' && (
                        <>
                            <div className={`flex border-b mb-6 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                {THREE_PILOT_CASES.map(c => (
                                    <button key={c.id} onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { threePilotCase: c.id }})} className={`flex-1 text-center py-2 px-4 font-semibold -mb-px border-b-2 transition-colors duration-200 ${
                                        threePilotCase === c.id 
                                            ? 'border-blue-500 text-blue-400' 
                                            : isDark 
                                                ? 'border-transparent text-gray-500 hover:text-gray-300' 
                                                : 'border-transparent text-gray-600 hover:text-gray-800'
                                    }`}>{c.id}</button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>PIC</h4>
                                    <FlightTimeline 
                                        segments={threePilotCase === 'CASE2' ? generateFOTimelineData.segments : generatePICTimelineData.segments}
                                        timePoints={threePilotCase === 'CASE2' ? generateFOTimelineData.timePoints : generatePICTimelineData.timePoints}
                                        progress={timelineProgress}
                                        isDark={isDark}
                                    />
                                </div>
                                <div>
                                    <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>FO</h4>
                                    <FlightTimeline 
                                        segments={threePilotCase === 'CASE2' ? generatePICTimelineData.segments : generateFOTimelineData.segments}
                                        timePoints={threePilotCase === 'CASE2' ? generatePICTimelineData.timePoints : generateFOTimelineData.timePoints}
                                        progress={timelineProgress}
                                        isDark={isDark}
                                    />
                                </div>
                                <div>
                                    <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>CRZ</h4>
                                    <FlightTimeline 
                                        segments={generateCRZTimelineData.segments}
                                        timePoints={generateCRZTimelineData.timePoints}
                                        progress={timelineProgress}
                                        isDark={isDark}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* 입력 폼 모달 */}
                {!showTimeline && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300">
                        <div className={`rounded-xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            <div className="p-6 sm:p-8 relative">
                                <button 
                                    onClick={() => setShowTimeline(true)} 
                                    className={`absolute top-4 right-4 transition-colors z-10 ${
                                        isDark 
                                            ? 'text-gray-500 hover:text-white' 
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>

                {/* 타임존 피커 모달 */}
                {showTimeZonePicker && (
                    <div 
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300"
                        onClick={() => setShowTimeZonePicker(false)}
                    >
                        <div 
                            className={`rounded-xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-4">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Time Zone 선택</h3>
                            </div>
                            
                            <div className="flex justify-center mb-4">
                                <div className="flex items-center justify-center gap-1 w-full">
                                    {/* "UTC" 라벨이 공간을 차지하되, 필요시 줄어들도록 설정 */}
                                    <div className="text-center flex-shrink-0"> 
                                        <span className={`text-s font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>UTC</span>
                                    </div>
                                    
                                    {/* 드럼이 남은 공간을 모두 차지하도록 설정 */}
                                    <div className={`p-1 rounded-lg shadow-lg flex-grow min-w-0 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} style={{ minWidth: '60px' }}>
                                        <div className="relative h-32 overflow-hidden">
                                            {/* 중앙 선택 영역 하이라이트 */}
                                            <div className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 bg-white/5 rounded-lg border-y border-white/10 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)', width: 'calc(100% - 2px)' }}></div>
                                            
                                            {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                            <div className={`absolute top-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-b from-gray-800 to-transparent' : 'bg-gradient-to-b from-gray-100 to-transparent'}`}></div>
                                            <div className={`absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-gray-100 to-transparent'}`}></div>
                                            
                                            <div
                                                ref={timeZonePickerRef}
                                                onScroll={handleScroll}
                                                className={`h-full overflow-y-scroll scroll-snap-y-mandatory snap-center custom-scrollbar ${isScrollingState ? 'scrolling' : ''}`}
                                                style={{
                                                    scrollbarWidth: 'thin',
                                                    scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
                                                    msOverflowStyle: 'none'
                                                }}
                                            >
                                                {(() => {
                                                    const UTC_OFFSETS = Array.from({ length: 26 }, (_, i) => i - 11); // -11 to +14
                                                    const padding = Array(2).fill(null); // 위아래 2개씩 여백
                                                    const displayItems = [...padding, ...UTC_OFFSETS, ...padding];
                                                    
                                                    return displayItems.map((offset, index) => {
                                                        const isSelected = offset === currentScrollValue;
                                                        
                                                        return (
                                                            <div
                                                                key={index}
                                                                                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${
                                                                isSelected 
                                                                    ? isDark ? 'text-white text-xl' : 'text-gray-900 text-xl' // 선택 시
                                                                    : isDark ? 'text-gray-500 text-base' : 'text-gray-600 text-base' // 비선택 시
                                                            }`}
                                                            >
                                                                {offset !== null ? (offset > 0 ? `+${offset}` : offset) : ''}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={() => setShowTimeZonePicker(false)}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                                        isDark 
                                            ? 'bg-gray-600 text-white hover:bg-gray-700' 
                                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                    }`}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => setShowTimeZonePicker(false)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                >
                                    완료
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CRZ1 피커 모달 */}
                {showCrz1Picker && (
                    <div 
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300"
                        onClick={() => setShowCrz1Picker(false)}
                    >
                        <div 
                            className={`rounded-xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-4">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>CRZ 1 시간 선택</h3>
                            </div>
                            
                            <div className="flex justify-center mb-4">
                                <div className={`p-1 rounded-lg shadow-lg w-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <div className="relative h-32 overflow-hidden">
                                        {/* 중앙 선택 영역 하이라이트 */}
                                        <div className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 bg-white/5 rounded-lg border-y border-white/10 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)', width: 'calc(100% - 2px)' }}></div>
                                        
                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                        <div className={`absolute top-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-b from-gray-800 to-transparent' : 'bg-gradient-to-b from-gray-100 to-transparent'}`}></div>
                                        <div className={`absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-gray-100 to-transparent'}`}></div>
                                        
                                        <div
                                            ref={crz1PickerRef}
                                            onScroll={handleCrz1Scroll}
                                            className={`h-full overflow-y-scroll scroll-snap-y-mandatory snap-center custom-scrollbar ${isCrz1ScrollingState ? 'scrolling' : ''}`}
                                            style={{
                                                scrollbarWidth: 'thin',
                                                scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
                                                msOverflowStyle: 'none'
                                            }}
                                        >
                                            {(() => {
                                                // CRZ1 시간 배열 생성 (1시간 00분부터 6시간 00분까지 5분 단위)
                                                const CRZ1_TIMES = [];
                                                for (let hour = 1; hour <= 6; hour++) {
                                                    for (let minute = 0; minute < 60; minute += 5) {
                                                        const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                                                        CRZ1_TIMES.push(timeString);
                                                    }
                                                }
                                                
                                                const padding = Array(2).fill(null); // 위아래 2개씩 여백
                                                const displayItems = [...padding, ...CRZ1_TIMES, ...padding];
                                                
                                                return displayItems.map((time, index) => {
                                                    const isSelected = time === currentCrz1ScrollValue;
                                                    
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${
                                                                isSelected 
                                                                    ? isDark ? 'text-white text-xl' : 'text-gray-900 text-xl' // 선택 시
                                                                    : isDark ? 'text-gray-500 text-base' : 'text-gray-600 text-base' // 비선택 시
                                                            }`}
                                                        >
                                                            {time !== null ? minutesToKoreanDisplay(timeToMinutes(time)) : ''}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={() => setShowCrz1Picker(false)}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                                        isDark 
                                            ? 'bg-gray-600 text-white hover:bg-gray-700' 
                                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                    }`}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => setShowCrz1Picker(false)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                >
                                    완료
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 이륙 후 드럼 픽커 모달 */}
                {showAfterTakeoffPicker && (
                    <div 
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300"
                        onClick={() => setShowAfterTakeoffPicker(false)}
                    >
                        <div 
                            className={`rounded-xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-4">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>이륙 후 시간 선택</h3>
                            </div>
                            
                            <div className="flex justify-center mb-4">
                                <div className={`p-1 rounded-lg shadow-lg w-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <div className="relative h-32 overflow-hidden">
                                        {/* 중앙 선택 영역 하이라이트 */}
                                        <div className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 bg-white/5 rounded-lg border-y border-white/10 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)', width: 'calc(100% - 2px)' }}></div>
                                        
                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                        <div className={`absolute top-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-b from-gray-800 to-transparent' : 'bg-gradient-to-b from-gray-100 to-transparent'}`}></div>
                                        <div className={`absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-gray-100 to-transparent'}`}></div>
                                        
                                        <div
                                            ref={afterTakeoffPickerRef}
                                            onScroll={handleAfterTakeoffScroll}
                                            className={`h-full overflow-y-scroll scroll-snap-y-mandatory snap-center custom-scrollbar ${isAfterTakeoffScrollingState ? 'scrolling' : ''}`}
                                            style={{
                                                scrollbarWidth: 'thin',
                                                scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
                                                msOverflowStyle: 'none'
                                            }}
                                        >
                                            {(() => {
                                                // 이륙 후 시간 배열 생성 (30분부터 6시간 00분까지 5분 단위)
                                                const AFTER_TAKEOFF_TIMES = [];
                                                for (let hour = 0; hour <= 6; hour++) {
                                                    for (let minute = 0; minute < 60; minute += 5) {
                                                        if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                                                        const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                                                        AFTER_TAKEOFF_TIMES.push(timeString);
                                                    }
                                                }
                                                
                                                const padding = Array(2).fill(null); // 위아래 2개씩 여백
                                                const displayItems = [...padding, ...AFTER_TAKEOFF_TIMES, ...padding];
                                                
                                                return displayItems.map((time, index) => {
                                                    // 각 모드별로 적절한 값 사용
                                                    let currentValue;
                                                    if (activeTab === '2set' && twoSetMode === '1교대') {
                                                        currentValue = afterTakeoff1교대;
                                                    } else if (activeTab === '3pilot') {
                                                        currentValue = afterTakeoff3Pilot;
                                                    } else {
                                                        currentValue = afterTakeoff;
                                                    }
                                                    const isSelected = time === currentAfterTakeoffScrollValue;
                                                    
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${
                                                                isSelected 
                                                                    ? isDark ? 'text-white text-xl' : 'text-gray-900 text-xl' // 선택 시
                                                                    : isDark ? 'text-gray-500 text-base' : 'text-gray-600 text-base' // 비선택 시
                                                            }`}
                                                        >
                                                            {time !== null ? minutesToKoreanDisplay(timeToMinutes(time)) : ''}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={() => setShowAfterTakeoffPicker(false)}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                                        isDark 
                                            ? 'bg-gray-600 text-white hover:bg-gray-700' 
                                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                    }`}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => setShowAfterTakeoffPicker(false)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                >
                                    완료
                                </button>
                            </div>
                        </div>
                    </div>
                )}





                {/* 착륙 전 드럼 픽커 모달 */}
                {showBeforeLandingPicker && (
                    <div 
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300"
                        onClick={() => setShowBeforeLandingPicker(false)}
                    >
                        <div 
                            className={`rounded-xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-4">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>착륙 전 시간 선택</h3>
                            </div>
                            
                            <div className="flex justify-center mb-4">
                                <div className={`p-1 rounded-lg shadow-lg w-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <div className="relative h-32 overflow-hidden">
                                        {/* 중앙 선택 영역 하이라이트 */}
                                        <div className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 bg-white/5 rounded-lg border-y border-white/10 z-10 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)', width: 'calc(100% - 2px)' }}></div>
                                        
                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                        <div className={`absolute top-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-b from-gray-800 to-transparent' : 'bg-gradient-to-b from-gray-100 to-transparent'}`}></div>
                                        <div className={`absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none ${isDark ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-gray-100 to-transparent'}`}></div>
                                        
                                        <div
                                            ref={beforeLandingPickerRef}
                                            onScroll={handleBeforeLandingScroll}
                                            className={`h-full overflow-y-scroll scroll-snap-y-mandatory snap-center custom-scrollbar ${isBeforeLandingScrollingState ? 'scrolling' : ''}`}
                                            style={{
                                                scrollbarWidth: 'thin',
                                                scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
                                                msOverflowStyle: 'none'
                                            }}
                                        >
                                            {(() => {
                                                // 착륙 전 시간 배열 생성 (30분부터 3시간 00분까지 5분 단위)
                                                const BEFORE_LANDING_TIMES = [];
                                                for (let hour = 0; hour <= 3; hour++) {
                                                    for (let minute = 0; minute < 60; minute += 5) {
                                                        if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                                                        const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                                                        BEFORE_LANDING_TIMES.push(timeString);
                                                    }
                                                }
                                                
                                                const padding = Array(2).fill(null); // 위아래 2개씩 여백
                                                const displayItems = [...padding, ...BEFORE_LANDING_TIMES, ...padding];
                                                
                                                return displayItems.map((time, index) => {
                                                    const isSelected = time === currentBeforeLandingScrollValue;
                                                    
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${
                                                                isSelected 
                                                                    ? isDark ? 'text-white text-xl' : 'text-gray-900 text-xl' // 선택 시
                                                                    : isDark ? 'text-gray-500 text-base' : 'text-gray-600 text-base' // 비선택 시
                                                            }`}
                                                        >
                                                            {time !== null ? minutesToKoreanDisplay(timeToMinutes(time)) : ''}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={() => setShowBeforeLandingPicker(false)}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                                        isDark 
                                            ? 'bg-gray-600 text-white hover:bg-gray-700' 
                                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                    }`}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => setShowBeforeLandingPicker(false)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                >
                                    완료
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                                
                                <div>
                                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                                        <CalculatorIcon className="mr-2 text-blue-500"/> 비행 정보 입력
                                    </h2>

                                    <div className={`flex border-b mb-6 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                        {TABS.map(tab => (
                                            <button key={tab.id} onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { activeTab: tab.id }})}
                                                className={`flex-1 text-center py-2 px-4 font-semibold -mb-px border-b-2 transition-colors duration-200 ${
                                                    activeTab === tab.id 
                                                        ? 'border-blue-500 text-blue-400' 
                                                        : isDark 
                                                            ? 'border-transparent text-gray-500 hover:text-gray-300' 
                                                            : 'border-transparent text-gray-600 hover:text-gray-800'
                                                }`}>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-6">
                                        {/* 총 비행시간 - 전체 너비 */}
                                        <div>
                                            <label htmlFor="flightTime" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>총 비행시간 (HHMM)</label>
                                            <input
                                                id="flightTime"
                                                type="text"
                                                inputMode="numeric"
                                                value={activeTab === '3pilot' ? flightTime3Pilot : flightTime}
                                                onChange={handleTimeInputChange(activeTab === '3pilot' ? 'flightTime3Pilot' : 'flightTime')}
                                                className={`w-full px-3 py-2 border rounded-lg text-center font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                                                    isDark 
                                                        ? 'bg-gray-700 border-gray-600 text-gray-100' 
                                                        : 'bg-white border-gray-300 text-gray-900'
                                                }`}
                                                maxLength={4}
                                            />
                                            <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {(() => {
                                                    if (activeTab === '3pilot') {
                                                        if (flightTimeMinutes3Pilot <= 0) return null;
                                                        const workTime = flightTimeMinutes3Pilot - Math.floor(flightTimeMinutes3Pilot / 3);
                                                        return `편조별 근무: ${minutesToKoreanDisplay(workTime)} / 휴식: ${minutesToKoreanDisplay(Math.floor(flightTimeMinutes3Pilot / 3))}`;
                                                    } else {
                                                        if (flightTimeMinutes2Set <= 0) return null;
                                                        if (activeTab === '2set' && twoSetMode === '2교대') {
                                                            return `편조별: ${minutesToKoreanDisplay(Math.floor(flightTimeMinutes2Set / 2))}`;
                                                        }
                                                        return `편조별: ${minutesToKoreanDisplay(Math.floor(flightTimeMinutes2Set / 2))}`;
                                                    }
                                                })()}
                                            </div>
                                        </div>

                                        {/* 이륙시간/타임존 - 전체 너비 */}
                                        <div>
                                            <div className="grid grid-cols-2 gap-x-4">
                                                <div>
                                                    <label htmlFor="departureTime" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>이륙시간 (UTC)</label>
                                                    <input 
                                                        id="departureTime" 
                                                        type="text" 
                                                        inputMode="numeric" 
                                                        value={departureTime} 
                                                        onChange={handleTimeInputChange('departureTime')} 
                                                        className={`w-full px-3 py-2 border rounded-lg text-center font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                                                            isDark 
                                                                ? 'bg-gray-700 border-gray-600 text-gray-100' 
                                                                : 'bg-white border-gray-300 text-gray-900'
                                                        }`} 
                                                        maxLength={4} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>Time Zone</label>
                                                    <div 
                                                        className={`w-full px-3 py-2 border rounded-lg text-center font-mono text-lg flex items-center justify-center min-h-[44px] cursor-pointer transition-colors ${
                                                            isDark 
                                                                ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-100' 
                                                                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900'
                                                        }`}
                                                        onClick={() => setShowTimeZonePicker(true)}
                                                    >
                                                        UTC {timeZone >= 0 ? '+' : ''}{timeZone}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {formatTimeDisplay(convertTime(timeToMinutes(departureTime), timeZone))}L / {formatTimeDisplay(convertTime(timeToMinutes(departureTime), 9))}K
                                            </div>
                                        </div>

                                        {activeTab === '2set' && twoSetMode === '2교대' && (
                                            <>
                                                <div className="sm:col-span-2 lg:col-span-2">
                                                    <div className="grid grid-cols-2 gap-x-4">
                                                        <DisplayInput label="이륙 후" value={minutesToKoreanDisplay(timeToMinutes(afterTakeoff))} onClick={() => setShowAfterTakeoffPicker(true)} isDark={isDark} />
                                                        <DisplayInput label="착륙 전" value={minutesToKoreanDisplay(timeToMinutes(beforeLanding))} onClick={() => setShowBeforeLandingPicker(true)} isDark={isDark} />
                                                    </div>
                                                    <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        MID: {(() => {
                                                            if (flightTimeMinutes2Set <= 0) return '0분';
                                                            const afterTakeoffMinutes = timeToMinutes(afterTakeoff);
                                                            const beforeLandingMinutes = timeToMinutes(beforeLanding);
                                                            const midCrzMinutes = Math.max(0, flightTimeMinutes2Set - afterTakeoffMinutes - crz1Minutes - crz2Minutes - beforeLandingMinutes);
                                                            return minutesToKoreanDisplay(midCrzMinutes);
                                                        })()}
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-x-4 col-span-2">
                                                    <DisplayInput 
                                                        label="CRZ 1" 
                                                        value={minutesToKoreanDisplay(timeToMinutes(crz1Time))} 
                                                        onClick={() => setShowCrz1Picker(true)} 
                                                        isDark={isDark}
                                                    />
                                                    <ReadOnlyDisplay 
                                                        label="CRZ 2" 
                                                        value={minutesToKoreanDisplay(crz2Minutes)}
                                                        isDark={isDark}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {activeTab === '2set' && twoSetMode === '1교대' && (
                                            <>
                                                <div className="sm:col-span-2 lg:col-span-2">
                                                    <div className="grid grid-cols-2 gap-x-4">
                                                        <DisplayInput label="이륙 후" value={minutesToKoreanDisplay(timeToMinutes(afterTakeoff1교대))} onClick={() => setShowAfterTakeoffPicker(true)} isDark={isDark} />
                                                        <ReadOnlyDisplay 
                                                            label="착륙 전" 
                                                            value={(() => {
                                                                if (flightTimeMinutes2Set <= 0) return '0분';
                                                                const afterTakeoffMinutes = timeToMinutes(afterTakeoff1교대);
                                                                const restPerCrew = Math.floor(flightTimeMinutes2Set / 2);
                                                                const beforeLandingMinutes = Math.max(0, restPerCrew - afterTakeoffMinutes);
                                                                return minutesToKoreanDisplay(beforeLandingMinutes);
                                                            })()}
                                                            isDark={isDark}
                                                        />
                                                    </div>
                                                    <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        CRZ: {(() => {
                                                            if (flightTimeMinutes2Set <= 0) return '0분';
                                                            const afterTakeoffMinutes = timeToMinutes(afterTakeoff1교대);
                                                            const restPerCrew = Math.floor(flightTimeMinutes2Set / 2);
                                                            const beforeLandingMinutes = Math.max(0, restPerCrew - afterTakeoffMinutes);
                                                            const crzMinutes = Math.max(0, flightTimeMinutes2Set - afterTakeoffMinutes - beforeLandingMinutes);
                                                            return minutesToKoreanDisplay(crzMinutes);
                                                        })()}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {activeTab === '3pilot' && (
                                            <DisplayInput label="이륙 후" value={minutesToKoreanDisplay(timeToMinutes(afterTakeoff3Pilot))} onClick={() => setShowAfterTakeoffPicker(true)} isDark={isDark} />
                                        )}
                                    </div>





                                    <div className="flex justify-end mt-8">
                                        <button 
                                            onClick={() => setShowTimeline(true)} 
                                            className="py-2 px-6 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                                        >
                                            완료
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestCalculator;
