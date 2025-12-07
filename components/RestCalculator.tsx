import React, { useState, useEffect, useMemo, useRef, memo, useCallback, useReducer } from 'react';
import { motion } from 'framer-motion';
import { saveRestInfo, getRestInfo, subscribeToRestInfo, RestInfo } from '../src/firebase/database';
import { getCurrentUser } from '../src/firebase/auth';
import RestAlarmModal from './modals/RestAlarmModal';
import { scheduleNextRestAlarm, cancelRestAlarms, calculateRestPeriods, RestPeriod, sendRestNotification } from '../src/utils/restAlarms';


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
    hidden?: boolean;
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
type TabKey = '2set' | '5p' | '3pilot';

const VIEW_TABS: { id: TabKey; label: string }[] = [
    { id: '2set', label: '2SET' },
    { id: '5p', label: '5P' },
    { id: '3pilot', label: '3PILOT' },
];
const INPUT_TABS: { id: TabKey; label: string }[] = [
    { id: '2set', label: '2SET' },
    { id: '5p', label: '5P' },
    { id: '3pilot', label: '3PILOT' },
];
const TWO_SET_MODES = [
    { id: '2교대', label: '2교대' },
    { id: '1교대', label: '1교대' },
];

const THREE_PILOT_MODES = [
    { id: 'CASE1', label: '3PILOT CASE 1' },
    { id: 'CASE2', label: '3PILOT CASE 2' },
];

const FIVE_P_COLORS = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-indigo-500',
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
        <rect width="16" height="20" x="4" y="2" rx="2" />
        <line x1="8" x2="16" y1="6" y2="6" />
        <line x1="16" x2="16" y1="14" y2="18" />
        <line x1="16" x2="16" y1="10" y2="10" />
        <line x1="10" x2="10" y1="10" y2="18" />
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
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1.5-1.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
));

// --- UI Components ---
const DisplayInput = memo(({ label, value, onClick, warning, isDark }: { label: string; value: string; onClick: () => void; warning?: string; isDark: boolean }) => (
    <div>
        <label className="block text-sm font-medium mb-1 text-slate-300">{label}</label>
        <div
            className={`w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg cursor-pointer flex items-center justify-center min-h-[44px] hover:bg-white/10 transition-colors ${warning ? 'border-rose-500/50 ring-1 ring-rose-500/30' : ''}`}
            onClick={onClick}
            role="button"
            style={{
                borderRadius: '12px',
                overflow: 'hidden',
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                maskImage: '-webkit-radial-gradient(white, black)'
            }}
        >
            {value}
        </div>
        {warning && <p className="text-xs text-rose-400 mt-1 text-center">{warning}</p>}
    </div>
));

const ReadOnlyDisplay = memo(({ label, value, isDark }: { label: string; value: string; isDark: boolean }) => (
    <div>
        <label className="block text-sm font-medium mb-1 text-slate-400">{label}</label>
        <div
            className="w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg flex items-center justify-center min-h-[44px] cursor-not-allowed opacity-60"
            style={{
                borderRadius: '12px',
                overflow: 'hidden',
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                maskImage: '-webkit-radial-gradient(white, black)'
            }}
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
            <div className="glass-card rounded-2xl p-8 text-center w-full min-h-[120px] flex flex-col justify-center items-center">
                <p className="text-slate-400 font-medium text-lg">
                    비행 시간을 입력해주세요
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="relative h-14 mb-8">
                {/* 타임라인 배경 트랙 */}
                <div className="absolute inset-0 w-full h-10 bg-black/30 rounded-full border border-white/10 backdrop-blur-md overflow-hidden shadow-inner">
                    {segments.map((segment, index) => {
                        const cumulativeDurationBefore = segments.slice(0, index).reduce((acc, s) => acc + s.duration, 0);
                        const elapsedTotalMinutes = progress * totalDuration;

                        let minutesToShow;
                        const isFlightCompleted = progress >= 1;

                        if (isFlightCompleted) {
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
                                className={`${segment.color} h-full relative float-left flex items-center justify-center transition-all duration-500 ${isCompleted && !isFlightCompleted ? 'opacity-30 grayscale' : 'opacity-90 hover:opacity-100'}`}
                                style={{
                                    width: `${(segment.duration / totalDuration) * 100}%`,
                                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* 글래스 효과 그라데이션 오버레이 */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/10 pointer-events-none"></div>
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-white/30 pointer-events-none"></div>

                                <span
                                    className={`text-white font-bold z-10 drop-shadow-md ${(segment.duration / totalDuration) * 100 < 15 ? 'text-xs' : (segment.duration / totalDuration) * 100 < 25 ? 'text-sm' : 'text-base'}`}
                                >
                                    {minutesToDisplayFormat(minutesToShow)}
                                </span>
                                {/* 세그먼트 구분선 */}
                                {index < segments.length - 1 && (
                                    <div className="absolute right-0 top-0 bottom-0 w-px bg-white/20 z-20"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 시간 표시 지점 */}
            <div className="relative h-24 text-xs">
                {timePoints.map((point, index) => {
                    if (point.hidden) return null;

                    let position = 0;
                    if (index === 0) {
                        position = (segments[0].duration / totalDuration) * 100;
                    } else if (index === 1) {
                        const cumulativeDuration = segments.slice(0, 2).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    } else if (index === 2) {
                        const cumulativeDuration = segments.slice(0, 3).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    } else if (index === 3) {
                        const cumulativeDuration = segments.slice(0, 4).reduce((acc, segment) => acc + segment.duration, 0);
                        position = (cumulativeDuration / totalDuration) * 100;
                    }

                    const isHighlighted = (() => {
                        if (segments.length === 0 || totalDuration === 0) return false;
                        const cumulativeDuration = segments.slice(0, index).reduce((acc, s) => acc + s.duration, 0);
                        const segmentStartProgress = cumulativeDuration / totalDuration;
                        const segmentEndProgress = (cumulativeDuration + segments[index].duration) / totalDuration;

                        if (progress === 0 && index === 0) return true;
                        return progress > segmentStartProgress && progress <= segmentEndProgress;
                    })();

                    return (
                        <div
                            key={index}
                            className="absolute transform -translate-x-1/2 transition-all duration-300"
                            style={{ left: `${position}%`, top: '-10px' }}
                        >
                            {/* 연결선 */}
                            <div className={`w-px h-4 mx-auto mb-1 transition-colors duration-300 ${isHighlighted ? 'bg-indigo-400' : 'bg-white/20'}`}></div>

                            {/* 시간 정보 카드 */}
                            <div
                                className={`
                                    px-3 py-2 rounded-xl text-center whitespace-nowrap backdrop-blur-md border transition-all duration-300
                                    ${isHighlighted
                                        ? 'bg-indigo-500/20 border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)] scale-105 z-10'
                                        : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
                                    }
                                `}
                            >
                                <p className={`font-bold text-sm mb-0.5 ${isHighlighted ? 'text-white' : 'text-slate-300'}`}>
                                    {point.zulu}
                                </p>
                                <div className="flex flex-col gap-0.5 text-[10px] opacity-80">
                                    <span className={isHighlighted ? 'text-indigo-200' : 'text-slate-500'}>{point.local}</span>
                                    <span className={isHighlighted ? 'text-indigo-200' : 'text-slate-500'}>{point.korea}</span>
                                </div>
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
    flightTime5P: '1420',
    flightTime3Pilot: '1420',
    departureTime: '0200',
    crz1Time: '0330',
    crz1Time5P: '0200',
    afterTakeoff: '0200',
    afterTakeoff1교대: '0200',
    afterTakeoff5P: '0200',
    afterTakeoff3Pilot: '0100',
    beforeLanding: '0100',
    beforeLanding1교대: '0100',
    timeZone: -4,
    threePilotMode: 'CASE1',
    afterTakeoff3PilotCase2: '0100',
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
        case 'LOAD_FROM_FIREBASE':
            return { ...state, ...action.payload };
        default:
            return state;
    }
};

const RestCalculator: React.FC<{ isDark: boolean }> = ({ isDark }) => {
    const [state, dispatch] = useReducer(reducer, defaultState, loadInitialState);

    // 테마 변경 감지를 위한 ref
    const prevIsDarkRef = useRef(isDark);

    // 테마가 변경되면 컴포넌트 강제 리렌더링
    useEffect(() => {
        if (prevIsDarkRef.current !== isDark) {
            prevIsDarkRef.current = isDark;
            // 테마 변경 시 강제 리렌더링을 위한 상태 업데이트
            dispatch({ type: 'UPDATE_STATE', payload: { themeChanged: Date.now() } });
        }
    }, [isDark]);
    const { activeTab, twoSetMode, flightTime, flightTime5P, flightTime3Pilot, departureTime, crz1Time, crz1Time5P, afterTakeoff, afterTakeoff1교대, afterTakeoff5P, afterTakeoff3Pilot, afterTakeoff3PilotCase2, beforeLanding, beforeLanding1교대, timeZone, threePilotMode } = state;

    // Firebase 동기화를 위한 상태
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isSyncing, setIsSyncing] = useState(false);


    const [currentTime, setCurrentTime] = useState(new Date());
    const [showTimeline, setShowTimeline] = useState(true);
    const [showTimeZonePicker, setShowTimeZonePicker] = useState(false);
    const [showCrz1Picker, setShowCrz1Picker] = useState(false);
    const [showAfterTakeoffPicker, setShowAfterTakeoffPicker] = useState(false);
    const [showBeforeLandingPicker, setShowBeforeLandingPicker] = useState(false);

    // 알람 상태
    const [isAlarmEnabled, setIsAlarmEnabled] = useState(() => {
        return localStorage.getItem('restAlarmEnabled') === 'true';
    });
    const [alarmModal, setAlarmModal] = useState<{ isOpen: boolean; periodName: string } | null>(null);

    const timeZonePickerRef = useRef<HTMLDivElement>(null);
    const crz1PickerRef = useRef<HTMLDivElement>(null);
    const afterTakeoffPickerRef = useRef<HTMLDivElement>(null);
    const beforeLandingPickerRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<NodeJS.Timeout | null>(null);
    const isCrz1Scrolling = useRef<NodeJS.Timeout | null>(null);
    const isAfterTakeoffScrolling = useRef<NodeJS.Timeout | null>(null);
    const isBeforeLandingScrolling = useRef<NodeJS.Timeout | null>(null);
    const [currentScrollValue, setCurrentScrollValue] = useState(timeZone);
    const preEditStateRef = useRef<any | null>(null);
    const lastStandardTwoSetModeRef = useRef(twoSetMode === '5P' ? '2교대' : twoSetMode);
    const [inputTab, setInputTab] = useState<TabKey>(() => {
        if (activeTab === '3pilot') return '3pilot';
        if (twoSetMode === '5P') return '5p';
        return '2set';
    });
    const [currentCrz1ScrollValue, setCurrentCrz1ScrollValue] = useState(() => (
        inputTab === '5p' ? crz1Time5P : crz1Time
    ));
    const [currentAfterTakeoffScrollValue, setCurrentAfterTakeoffScrollValue] = useState(() => {
        if (activeTab === '2set' && twoSetMode === '1교대') {
            return afterTakeoff1교대;
        } else if (activeTab === '2set' && twoSetMode === '5P') {
            return afterTakeoff5P;
        } else if (activeTab === '3pilot') {
            return threePilotMode === 'CASE2' ? afterTakeoff3PilotCase2 : afterTakeoff3Pilot;
        } else {
            return afterTakeoff;
        }
    });
    const [currentBeforeLandingScrollValue, setCurrentBeforeLandingScrollValue] = useState(beforeLanding);
    const [isScrollingState, setIsScrollingState] = useState(false);
    const [isCrz1ScrollingState, setIsCrz1ScrollingState] = useState(false);
    const [isAfterTakeoffScrollingState, setIsAfterTakeoffScrollingState] = useState(false);
    const [isBeforeLandingScrollingState, setIsBeforeLandingScrollingState] = useState(false);
    const [isFlightTimeInputFocused, setIsFlightTimeInputFocused] = useState(false);
    const [isAfterTakeoff5PInputFocused, setIsAfterTakeoff5PInputFocused] = useState(false);

    useEffect(() => {
        if (twoSetMode !== '5P') {
            lastStandardTwoSetModeRef.current = twoSetMode;
        }
    }, [twoSetMode]);

    useEffect(() => {
        if (activeTab === '3pilot') {
            setInputTab('3pilot');
        } else if (twoSetMode === '5P') {
            setInputTab('5p');
        } else {
            setInputTab('2set');
        }
    }, [activeTab, twoSetMode]);

    // 휴식 알람 이벤트 리스너 설정
    useEffect(() => {
        const handleRestAlarm = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { periodName } = customEvent.detail;

            setAlarmModal({
                isOpen: true,
                periodName: periodName
            });

            // 시스템 알림 발송 (사용자 요청)
            if ('Notification' in window && Notification.permission === 'granted') {
                sendRestNotification('휴식 알림', `${periodName} 종료 15분 전입니다.`);
            }
        };

        window.addEventListener('rest-alarm', handleRestAlarm);

        return () => {
            window.removeEventListener('rest-alarm', handleRestAlarm);
        };
    }, []);



    const handleTestNotification = useCallback(async () => {
        if (!('Notification' in window)) {
            alert('이 브라우저는 알림을 지원하지 않습니다.');
            return;
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('알림 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.');
                return;
            }
        }

        alert('5초 뒤에 테스트 알림이 발송됩니다.\n홈 화면으로 나가서 알림이 오는지 확인해보세요!');

        setTimeout(() => {
            sendRestNotification('알림 테스트 성공! 🎉', '시스템 알림이 정상적으로 작동합니다.');
        }, 5000);
    }, []);

    const handleCancelEdit = useCallback(() => {
        if (preEditStateRef.current) {
            dispatch({ type: 'UPDATE_STATE', payload: preEditStateRef.current });
        }
        setShowTimeline(true);
    }, [activeTab, twoSetMode, dispatch]);

    const handleInputTabChange = useCallback((tabId: TabKey) => {
        if (tabId === '3pilot') {
            setInputTab('3pilot');
            dispatch({ type: 'UPDATE_STATE', payload: { activeTab: '3pilot' } });
            return;
        }

        if (tabId === '5p') {
            setInputTab('5p');
            dispatch({ type: 'UPDATE_STATE', payload: { activeTab: '2set', twoSetMode: '5P' } });
            return;
        }

        // tabId === '2set'
        setInputTab('2set');
        const payload: any = { activeTab: '2set' };
        if (twoSetMode === '5P') {
            payload.twoSetMode = lastStandardTwoSetModeRef.current || '2교대';
        }
        dispatch({ type: 'UPDATE_STATE', payload });
    }, [dispatch, twoSetMode]);

    const handleViewTabChange = useCallback((tabId: TabKey) => {
        if (tabId === '3pilot') {
            if (activeTab !== '3pilot') {
                dispatch({ type: 'UPDATE_STATE', payload: { activeTab: '3pilot' } });
            }
            return;
        }

        if (tabId === '5p') {
            const payload: any = {};
            if (activeTab !== '2set') payload.activeTab = '2set';
            if (twoSetMode !== '5P') payload.twoSetMode = '5P';
            if (Object.keys(payload).length > 0) {
                dispatch({ type: 'UPDATE_STATE', payload });
            }
            return;
        }

        // tabId === '2set'
        const payload: any = {};
        if (activeTab !== '2set') payload.activeTab = '2set';
        if (twoSetMode === '5P') payload.twoSetMode = lastStandardTwoSetModeRef.current || '2교대';
        if (Object.keys(payload).length > 0) {
            dispatch({ type: 'UPDATE_STATE', payload });
        }
    }, [activeTab, twoSetMode, dispatch]);

    const isViewTabActive = useCallback((tabId: TabKey) => {
        if (tabId === '5p') {
            return activeTab === '2set' && twoSetMode === '5P';
        }
        if (tabId === '2set') {
            return activeTab === '2set' && twoSetMode !== '5P';
        }
        return activeTab === '3pilot';
    }, [activeTab, twoSetMode]);

    const formatDisplayTime = useCallback((value: string) => {
        if (!value) return '';
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length === 0) return '';
        const padded = numericValue.padStart(4, '0').slice(-4);
        const hours = parseInt(padded.slice(0, 2), 10) || 0;
        const minutes = parseInt(padded.slice(2, 4), 10) || 0;
        if (!hours && !minutes) return '';
        return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
    }, []);

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

    // 사용자 정보 가져오기
    useEffect(() => {
        const getUser = async () => {
            try {
                const user = await getCurrentUser();
                setCurrentUser(user);
            } catch (error) {
                console.error('사용자 정보 가져오기 실패:', error);
            }
        };
        getUser();
    }, []);

    // Firebase에서 REST 정보 불러오기
    useEffect(() => {
        if (!currentUser?.uid) return;

        const loadRestInfo = async () => {
            try {
                const savedRestInfo = await getRestInfo(currentUser.uid);
                if (savedRestInfo) {
                    const payload = { ...savedRestInfo, threePilotMode: savedRestInfo.threePilotCase };
                    dispatch({ type: 'LOAD_FROM_FIREBASE', payload });
                }
            } catch (error) {
                console.error('REST 정보 불러오기 실패:', error);
            }
        };

        loadRestInfo();
    }, [currentUser]);

    // Firebase 실시간 동기화 구독
    useEffect(() => {
        if (!currentUser?.uid) return;

        const unsubscribe = subscribeToRestInfo(currentUser.uid, (restInfo) => {
            if (restInfo) {
                const payload = { ...restInfo, threePilotMode: restInfo.threePilotCase };
                dispatch({ type: 'LOAD_FROM_FIREBASE', payload });
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // REST 정보를 Firebase에 저장
    const saveToFirebase = useCallback(async (restState: any) => {
        if (!currentUser?.uid || isSyncing) return;

        try {
            setIsSyncing(true);
            const restInfo: RestInfo = {
                activeTab: restState.activeTab,
                twoSetMode: restState.twoSetMode,
                flightTime: restState.flightTime,
                flightTime5P: restState.flightTime5P,
                flightTime3Pilot: restState.flightTime3Pilot,
                departureTime: restState.departureTime,
                crz1Time: restState.crz1Time,
                crz1Time5P: restState.crz1Time5P,
                afterTakeoff: restState.afterTakeoff,
                afterTakeoff1교대: restState.afterTakeoff1교대,
                afterTakeoff5P: restState.afterTakeoff5P,
                afterTakeoff3Pilot: restState.afterTakeoff3Pilot,
                beforeLanding: restState.beforeLanding,
                beforeLanding1교대: restState.beforeLanding1교대,
                timeZone: restState.timeZone,
                threePilotCase: restState.threePilotMode || 'CASE1',
                afterTakeoff3PilotCase2: restState.afterTakeoff3PilotCase2 || '0100',
                lastUpdated: new Date().toISOString()
            };

            await saveRestInfo(currentUser.uid, {
                ...restInfo,
                threePilotCase: restInfo.threePilotCase as 'CASE1' | 'CASE2'
            });
        } catch (error) {
            console.error('REST 정보 저장 실패:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [currentUser, isSyncing]);

    // 수동 저장을 위한 함수 (완료 버튼에서 호출)
    const handleSaveToFirebase = useCallback(async () => {
        if (!currentUser?.uid) {
            alert('로그인이 필요합니다.');
            return;
        }

        try {
            setIsSyncing(true);
            const restInfo: RestInfo = {
                activeTab: state.activeTab,
                twoSetMode: state.twoSetMode,
                flightTime: state.flightTime,
                flightTime5P: state.flightTime5P,
                flightTime3Pilot: state.flightTime3Pilot,
                departureTime: state.departureTime,
                crz1Time: state.crz1Time,
                crz1Time5P: state.crz1Time5P,
                afterTakeoff: state.afterTakeoff,
                afterTakeoff1교대: state.afterTakeoff1교대,
                afterTakeoff5P: state.afterTakeoff5P,
                afterTakeoff3Pilot: state.afterTakeoff3Pilot,
                beforeLanding: state.beforeLanding,
                beforeLanding1교대: state.beforeLanding1교대,
                timeZone: state.timeZone,
                threePilotCase: state.threePilotMode,
                afterTakeoff3PilotCase2: state.afterTakeoff3PilotCase2,
                lastUpdated: new Date().toISOString()
            };

            await saveRestInfo(currentUser.uid, restInfo);
        } catch (error) {
            console.error('REST 정보 저장 실패:', error);
            alert('저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsSyncing(false);
        }
    }, [currentUser, state]);

    const handleCompleteEditing = useCallback(async () => {
        setShowTimeline(true);
        await handleSaveToFirebase();
    }, [handleSaveToFirebase]);

    const flightTimeMinutes2Set = useMemo(() => timeToMinutes(flightTime), [flightTime]);
    const flightTimeMinutes5P = useMemo(() => timeToMinutes(flightTime5P), [flightTime5P]);
    const flightTimeMinutes3Pilot = useMemo(() => timeToMinutes(flightTime3Pilot), [flightTime3Pilot]);

    const flightTimeMinutes = useMemo(() => {
        if (activeTab === '3pilot') return flightTimeMinutes3Pilot;
        if (twoSetMode === '5P') return flightTimeMinutes5P;
        return flightTimeMinutes2Set;
    }, [activeTab, twoSetMode, flightTimeMinutes2Set, flightTimeMinutes3Pilot, flightTimeMinutes5P]);

    const currentFlightTimeValue = useMemo(() => {
        return inputTab === '3pilot' ? flightTime3Pilot : inputTab === '5p' ? flightTime5P : flightTime;
    }, [inputTab, flightTime, flightTime5P, flightTime3Pilot]);

    const flightTimeInputDisplayValue = useMemo(() => {
        if (isFlightTimeInputFocused) return currentFlightTimeValue;
        return formatDisplayTime(currentFlightTimeValue) || '';
    }, [isFlightTimeInputFocused, currentFlightTimeValue, formatDisplayTime]);

    const afterTakeoff5PDisplayValue = useMemo(() => {
        if (isAfterTakeoff5PInputFocused) return afterTakeoff5P;
        return formatDisplayTime(afterTakeoff5P) || '';
    }, [isAfterTakeoff5PInputFocused, afterTakeoff5P, formatDisplayTime]);

    const fivePTwoFifthsMinutes = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        return Math.floor((flightTimeMinutes5P * 2) / 5);
    }, [flightTimeMinutes5P]);

    const afterTakeoffMinutes5P = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        const minutes = timeToMinutes(afterTakeoff5P);
        return Math.min(Math.max(minutes, 0), flightTimeMinutes5P);
    }, [afterTakeoff5P, flightTimeMinutes5P]);

    const crz1Minutes5P = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        const minutes = Math.max(0, timeToMinutes(crz1Time5P));
        const available = Math.max(0, flightTimeMinutes5P - afterTakeoffMinutes5P);
        return Math.min(minutes, available);
    }, [crz1Time5P, flightTimeMinutes5P, afterTakeoffMinutes5P]);

    const crz2Minutes5P = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        const crz1InputMinutes = Math.max(0, timeToMinutes(crz1Time5P));
        const desiredCrz2 = Math.max(0, fivePTwoFifthsMinutes - crz1InputMinutes);
        const available = Math.max(0, flightTimeMinutes5P - afterTakeoffMinutes5P - crz1Minutes5P);
        return Math.min(desiredCrz2, available);
    }, [crz1Time5P, fivePTwoFifthsMinutes, flightTimeMinutes5P, afterTakeoffMinutes5P, crz1Minutes5P]);

    const beforeLandingMinutes5P = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        const desiredBeforeLanding = Math.max(0, fivePTwoFifthsMinutes - afterTakeoffMinutes5P);
        const available = Math.max(0, flightTimeMinutes5P - afterTakeoffMinutes5P - crz1Minutes5P - crz2Minutes5P);
        return Math.min(desiredBeforeLanding, available);
    }, [fivePTwoFifthsMinutes, afterTakeoffMinutes5P, flightTimeMinutes5P, crz1Minutes5P, crz2Minutes5P]);

    const midMinutes5P = useMemo(() => {
        if (flightTimeMinutes5P <= 0) return 0;
        return Math.max(0, flightTimeMinutes5P - afterTakeoffMinutes5P - crz1Minutes5P - crz2Minutes5P - beforeLandingMinutes5P);
    }, [flightTimeMinutes5P, afterTakeoffMinutes5P, crz1Minutes5P, crz2Minutes5P, beforeLandingMinutes5P]);

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

    useEffect(() => {
        if (flightTimeMinutes5P <= 0) {
            if (crz1Time5P !== '0000') {
                dispatch({ type: 'UPDATE_STATE', payload: { crz1Time5P: '0000' } });
            }
            return;
        }

        const targetMinutes = Math.max(0, Math.floor(flightTimeMinutes5P / 5));
        const available = Math.max(0, flightTimeMinutes5P - afterTakeoffMinutes5P);
        const defaultCrz1Minutes = Math.min(targetMinutes, available);
        const defaultCrz1HHMM = minutesToHHMM(defaultCrz1Minutes);

        if (crz1Time5P !== defaultCrz1HHMM) {
            dispatch({ type: 'UPDATE_STATE', payload: { crz1Time5P: defaultCrz1HHMM } });
        }
    }, [flightTimeMinutes5P, afterTakeoffMinutes5P, crz1Time5P, dispatch]);

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
        } else if (activeTab === '2set' && twoSetMode === '5P') {
            if (flightTimeMinutes5P <= 0) {
                return { segments: [], timePoints: [] };
            }

            const segments: TimelineSegment[] = [
                { label: '이륙 후', duration: afterTakeoffMinutes5P, color: 'bg-blue-500' },
                { label: 'CRZ 1', duration: crz1Minutes5P, color: 'bg-teal-700' },
                { label: '남은 시간', duration: midMinutes5P, color: 'bg-orange-500' },
                { label: 'CRZ 2', duration: crz2Minutes5P, color: 'bg-cyan-500' },
                { label: '착륙 전', duration: beforeLandingMinutes5P, color: 'bg-lime-500' },
            ];

            const timePoints: TimePoint[] = [];
            let currentTime = departureMinutesUTC;

            currentTime += afterTakeoffMinutes5P;
            timePoints.push({
                label: '이륙 후',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            currentTime += crz1Minutes5P;
            timePoints.push({
                label: 'CRZ 1',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            currentTime += midMinutes5P;
            currentTime += crz2Minutes5P;
            timePoints.push({
                label: 'CRZ 2',
                zulu: formatTimeDisplay(convertZuluTime(currentTime)) + 'Z',
                local: formatTimeDisplay(convertTime(currentTime, timeZone)) + 'L',
                korea: formatTimeDisplay(convertTime(currentTime, 9)) + 'K'
            });

            currentTime += beforeLandingMinutes5P;
            timePoints.push({
                label: '착륙 전',
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

    }, [
        activeTab,
        twoSetMode,
        flightTimeMinutes,
        flightTimeMinutes5P,
        afterTakeoff,
        afterTakeoff1교대,
        afterTakeoff3Pilot,
        afterTakeoff5P,
        afterTakeoffMinutes5P,
        beforeLanding,
        beforeLanding1교대,
        beforeLandingMinutes5P,
        crz1Time,
        crz1Time5P,
        crz1Minutes,
        crz2Minutes,
        crz1Minutes5P,
        crz2Minutes5P,
        midMinutes5P,
        departureTime,
        timeZone
    ]);

    const activeAfterTakeoff3Pilot = threePilotMode === 'CASE2' ? afterTakeoff3PilotCase2 : afterTakeoff3Pilot;

    // 3PILOT 모드에서 각 타임라인을 다르게 생성하는 함수들
    const generatePICTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };

        const afterTakeoffMinutes = timeToMinutes(activeAfterTakeoff3Pilot);
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
    }, [activeTab, flightTimeMinutes, activeAfterTakeoff3Pilot, departureTime, timeZone]);

    const generateFOTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };

        const afterTakeoffMinutes = timeToMinutes(activeAfterTakeoff3Pilot);
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
    }, [activeTab, flightTimeMinutes, activeAfterTakeoff3Pilot, departureTime, timeZone]);

    const generateCRZTimelineData = useMemo(() => {
        if (activeTab !== '3pilot') return { segments: [], timePoints: [] };

        const afterTakeoffMinutes = timeToMinutes(activeAfterTakeoff3Pilot);
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
    }, [activeTab, flightTimeMinutes, activeAfterTakeoff3Pilot, departureTime, timeZone]);

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
        const rawValue = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (['flightTime', 'flightTime5P', 'flightTime3Pilot'].includes(field)) {
            const payload: any = {
                flightTime: rawValue,
                flightTime5P: rawValue,
                flightTime3Pilot: rawValue
            };

            // 5P 모드일 때 이륙 후 시간을 총 비행시간의 1/5로 자동 설정
            const flightMinutes = timeToMinutes(rawValue);
            if (flightMinutes > 0) {
                const oneFifthMinutes = Math.floor(flightMinutes / 5);
                payload.afterTakeoff5P = minutesToHHMM(oneFifthMinutes);
            }

            dispatch({
                type: 'UPDATE_STATE',
                payload
            });
        } else {
            dispatch({ type: 'SET_TIME', payload: { field, value: rawValue } });
        }
    }, [dispatch]);

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

                if (inputTab === '5p') {
                    dispatch({ type: 'UPDATE_STATE', payload: { crz1Time5P: newValue } });
                } else {
                    dispatch({ type: 'UPDATE_STATE', payload: { crz1Time: newValue } });
                }

                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsCrz1ScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, [inputTab, dispatch]);

    // 초기 스크롤 위치 설정
    useEffect(() => {
        if (showTimeZonePicker && timeZonePickerRef.current) { // 모달이 보일 때만 실행
            setTimeout(() => {
                if (!timeZonePickerRef.current) return;
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
            }, 0);
        }
    }, [showTimeZonePicker, timeZone]); // showTimeZonePicker를 의존성에 추가

    // CRZ1 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showCrz1Picker && crz1PickerRef.current) {
            setTimeout(() => {
                if (!crz1PickerRef.current) return;
                // CRZ1 시간 배열 생성 (1시간 00분부터 6시간 00분까지 5분 단위)
                const CRZ1_TIMES = [];
                for (let hour = 1; hour <= 6; hour++) {
                    for (let minute = 0; minute < 60; minute += 5) {
                        const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                        CRZ1_TIMES.push(timeString);
                    }
                }

                const currentCrz1Value = inputTab === '5p' ? crz1Time5P : crz1Time;
                const initialIndex = CRZ1_TIMES.indexOf(currentCrz1Value);
                const itemHeight = 48;
                const containerHeight = 128; // h-32
                const centerOffset = (containerHeight - itemHeight) / 2; // 중앙 오프셋
                const padding = 2;

                if (initialIndex !== -1) {
                    const targetIndex = initialIndex + padding;
                    const targetScrollTop = (targetIndex * itemHeight) - centerOffset;
                    crz1PickerRef.current.scrollTop = targetScrollTop;
                    setCurrentCrz1ScrollValue(currentCrz1Value);
                }
            }, 0);
        }
    }, [showCrz1Picker, crz1Time, crz1Time5P, inputTab]);

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
            const step = (activeTab === '2set' && twoSetMode === '5P') ? 1 : 5;

            for (let hour = 0; hour <= 6; hour++) {
                for (let minute = 0; minute < 60; minute += step) {
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
                } else if (activeTab === '2set' && twoSetMode === '5P') {
                    dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff5P: newValue } });
                } else if (activeTab === '3pilot') {
                    if (threePilotMode === 'CASE2') {
                        dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff3PilotCase2: newValue } });
                    } else {
                        dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff3Pilot: newValue } });
                    }
                } else {
                    dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff: newValue } });
                }

                // 스크롤 완료 후 상태 해제
                setTimeout(() => {
                    setIsAfterTakeoffScrollingState(false);
                }, 300); // 스크롤 애니메이션 완료 후 숨김
            }, 150);
        }
    }, [activeTab, dispatch, twoSetMode, threePilotMode]);





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
    }, [dispatch]);

    // 이륙 후 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showAfterTakeoffPicker && afterTakeoffPickerRef.current) {
            setTimeout(() => {
                if (!afterTakeoffPickerRef.current) return;
                // 이륙 후 시간 배열 생성
                const AFTER_TAKEOFF_TIMES: string[] = [];
                const step = (activeTab === '2set' && twoSetMode === '5P') ? 1 : 5;

                for (let hour = 0; hour <= 6; hour++) {
                    for (let minute = 0; minute < 60; minute += step) {
                        if (hour === 0 && minute < 30) continue; // 30분 미만은 제외
                        const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                        AFTER_TAKEOFF_TIMES.push(timeString);
                    }
                }

                // 각 모드별로 적절한 값 사용
                let currentAfterTakeoffValue;
                if (activeTab === '2set' && twoSetMode === '1교대') {
                    currentAfterTakeoffValue = afterTakeoff1교대;
                } else if (activeTab === '2set' && twoSetMode === '5P') {
                    currentAfterTakeoffValue = afterTakeoff5P;
                } else if (activeTab === '3pilot') {
                    currentAfterTakeoffValue = threePilotMode === 'CASE2' ? afterTakeoff3PilotCase2 : afterTakeoff3Pilot;
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
            }, 0);
        }
    }, [showAfterTakeoffPicker, afterTakeoff, afterTakeoff1교대, afterTakeoff5P, afterTakeoff3Pilot, afterTakeoff3PilotCase2, activeTab, twoSetMode, threePilotMode]);





    // 착륙 전 드럼 픽커 초기 스크롤 위치 설정
    useEffect(() => {
        if (showBeforeLandingPicker && beforeLandingPickerRef.current) {
            setTimeout(() => {
                if (!beforeLandingPickerRef.current) return;
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
            }, 0);
        }
    }, [showBeforeLandingPicker, beforeLanding]);

    // ✨ [위치 이동] 알람 스케줄링 로직 (실제 타임라인 데이터 사용)
    useEffect(() => {
        if (!isAlarmEnabled) {
            cancelRestAlarms();
            return;
        }

        const flightTimeVal = activeTab === '3pilot' ? flightTime3Pilot : activeTab === '5p' ? flightTime5P : flightTime;
        const flightTimeMin = timeToMinutes(flightTimeVal);

        if (!departureTime || flightTimeMin <= 0) return;

        // 현재 활성화된 모드의 세그먼트 데이터 선택
        let targetSegments: TimelineSegment[] = [];

        if (activeTab === '2set') {
            targetSegments = generateTimelineData.segments;
        } else if (activeTab === '3pilot') {
            targetSegments = threePilotMode === 'CASE2' ? generateFOTimelineData.segments : generatePICTimelineData.segments;
        }

        if (!targetSegments || targetSegments.length === 0) return;

        // 이륙 시간(Date) 추정
        const depHours = parseInt(departureTime.slice(0, 2));
        const depMinutes = parseInt(departureTime.slice(2, 4));
        const now = new Date();

        // 후보: 어제, 오늘, 내일
        const candidates = [-1, 0, 1].map(offset => {
            const d = new Date(now);
            d.setDate(d.getDate() + offset);
            d.setHours(depHours, depMinutes, 0, 0);
            return d;
        });

        // 1. 현재 비행 중인 경우 (이륙 ~ 착륙 사이에 현재가 포함됨)
        let determinedDeparture = candidates.find(d => {
            const landing = new Date(d.getTime() + flightTimeMin * 60000);
            return d <= now && now <= landing;
        });

        // 2. 비행 중이 아니라면 가장 가까운 미래 (곧 이륙)
        if (!determinedDeparture) {
            determinedDeparture = candidates.filter(d => d > now).sort((a, b) => a.getTime() - b.getTime())[0];
        }

        // 3. 미래도 없다면 가장 가까운 과거 (이미 착륙)
        if (!determinedDeparture) determinedDeparture = candidates[1];

        // 알람 구간 생성
        const periods: RestPeriod[] = [];
        let accumulatedMinutes = 0;

        targetSegments.forEach(seg => {
            accumulatedMinutes += seg.duration;
            const endTime = new Date(determinedDeparture!.getTime() + accumulatedMinutes * 60000);
            periods.push({
                name: seg.label,
                endTime: endTime
            });
        });

        // 스케줄링
        scheduleNextRestAlarm(periods);

        return () => cancelRestAlarms();

    }, [isAlarmEnabled, departureTime, flightTime, flightTime5P, flightTime3Pilot, activeTab, twoSetMode, threePilotMode, generateTimelineData, generatePICTimelineData, generateFOTimelineData]);

    return (
        <div className={`transition-colors duration-500 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            <div className="max-w-screen-xl mx-auto">
                {/* 타임라인 화면 */}
                <div className="glass-panel rounded-2xl p-6">


                    <div className="glass-panel rounded-xl p-1 flex mb-6">
                        {VIEW_TABS.map(tab => {
                            const isActive = isViewTabActive(tab.id);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleViewTabChange(tab.id)}
                                    className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${isActive
                                        ? 'text-white'
                                        : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeViewTab"
                                            className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className="relative p-6 rounded-2xl mb-6 cursor-pointer transition-all duration-300 glass-input hover:bg-white/10 group overflow-hidden"
                        onClick={() => { preEditStateRef.current = { ...state }; setShowTimeline(false); }}
                        style={{
                            borderRadius: '16px',
                            overflow: 'hidden',
                            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                            maskImage: '-webkit-radial-gradient(white, black)'
                        }}
                    >
                        {/* 배경 장식 효과 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="flex justify-between items-center relative z-10">
                            {/* 이륙 정보 (좌측) */}
                            <div className="flex flex-col items-start min-w-[100px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    <span className={`text-xs font-bold tracking-wider uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Departure</span>
                                </div>
                                <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formatTimeDisplay(departureTime)}
                                </div>
                                <div className={`text-xs sm:text-sm font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {formatTimeDisplay(convertTime(departureMinutesUTC, timeZone))}L / {formatTimeDisplay(convertTime(departureMinutesUTC, 9))}K
                                </div>
                            </div>

                            {/* 비행 경로 시각화 (중앙) */}
                            <div className="flex-1 flex flex-col items-center px-4 sm:px-8">
                                <div className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold font-mono mb-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                    {minutesToHhMm(flightTimeMinutes)}
                                </div>
                                <div className="w-full relative flex items-center justify-center">
                                    {/* 점선 */}
                                    <div className={`absolute w-full h-px border-t-2 border-dashed ${isDark ? 'border-gray-600' : 'border-gray-300'}`}></div>
                                    {/* 비행기 아이콘 */}
                                    <div className={`relative z-10 p-2 rounded-full ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-white text-blue-600'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </div>
                                </div>
                                <div className={`text-xs font-medium mt-2 px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                    UTC {timeZone >= 0 ? '+' : ''}{timeZone}
                                </div>
                            </div>

                            {/* 착륙 정보 (우측) */}
                            <div className="flex flex-col items-end min-w-[100px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold tracking-wider uppercase ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`}>Arrival</span>
                                    <svg className={`w-5 h-5 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                                <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formatTimeDisplay(convertZuluTime(departureMinutesUTC + flightTimeMinutes))}
                                </div>
                                <div className={`text-xs sm:text-sm font-medium mt-1 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {formatTimeDisplay(convertTime(departureMinutesUTC + flightTimeMinutes, timeZone))}L / {formatTimeDisplay(convertTime(departureMinutesUTC + flightTimeMinutes, 9))}K
                                </div>
                            </div>
                        </div>
                    </div>

                    {activeTab === '2set' && (
                        <>
                            {twoSetMode !== '5P' && (
                                <div className="glass-panel rounded-xl p-1 flex mb-6">
                                    {TWO_SET_MODES.map(mode => {
                                        const isActive = twoSetMode === mode.id;
                                        return (
                                            <button
                                                key={mode.id}
                                                onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { twoSetMode: mode.id } })}
                                                className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${isActive
                                                    ? 'text-white'
                                                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                                    }`}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeTwoSetTab"
                                                        className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )}
                                                {mode.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
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
                            <div className="glass-panel rounded-xl p-1 flex mb-6">
                                {THREE_PILOT_MODES.map(c => {
                                    const isActive = threePilotMode === c.id;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { threePilotMode: c.id } })}
                                            className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${isActive
                                                ? 'text-white'
                                                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                                }`}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeThreePilotTab"
                                                    className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            {c.id}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>PIC</h4>
                                    <FlightTimeline
                                        segments={threePilotMode === 'CASE2' ? generateFOTimelineData.segments : generatePICTimelineData.segments}
                                        timePoints={threePilotMode === 'CASE2' ? generateFOTimelineData.timePoints : generatePICTimelineData.timePoints}
                                        progress={timelineProgress}
                                        isDark={isDark}
                                    />
                                </div>
                                <div>
                                    <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>FO</h4>
                                    <FlightTimeline
                                        segments={threePilotMode === 'CASE2' ? generatePICTimelineData.segments : generateFOTimelineData.segments}
                                        timePoints={threePilotMode === 'CASE2' ? generatePICTimelineData.timePoints : generateFOTimelineData.timePoints}
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 pt-safe" onClick={handleCancelEdit}>
                        <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] relative animate-fade-in-up flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 sm:p-8 relative">
                                <button
                                    onClick={handleCancelEdit}
                                    className={`absolute top-4 right-4 transition-colors z-10 p-2 rounded-full hover:bg-white/10 ${isDark
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
                                        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 pt-safe"
                                        onClick={() => setShowTimeZonePicker(false)}
                                    >
                                        <div
                                            className="glass-card rounded-2xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3"
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
                                                    <div className="p-1 rounded-xl shadow-lg flex-grow min-w-0 bg-black/20 backdrop-blur-sm" style={{ minWidth: '60px' }}>
                                                        <div className="relative h-32 overflow-hidden">
                                                            {/* 중앙 선택 영역 하이라이트 */}


                                                            {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                                            <div className="absolute top-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-b from-black/50 to-transparent"></div>
                                                            <div className="absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-t from-black/50 to-transparent"></div>

                                                            <div
                                                                ref={timeZonePickerRef}
                                                                onScroll={handleScroll}
                                                                className={`h-full overflow-y-scroll custom-scrollbar ${isScrollingState ? 'scrolling' : ''}`}
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
                                                                                className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer transition-all duration-200 ${isSelected
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
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isDark ? 'bg-gray-600 group-hover:bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`} />
                                                    <span className={`relative z-10 ${isDark ? 'text-white' : 'text-gray-700'}`}>취소</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await handleSaveToFirebase();
                                                        setShowTimeZonePicker(false);
                                                    }}
                                                    disabled={isSyncing}
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 group-hover:bg-blue-600'}`} />
                                                    <span className={`relative z-10 ${isSyncing ? 'text-gray-200' : 'text-white'}`}>{isSyncing ? '저장 중...' : '완료'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CRZ1 피커 모달 */}
                                {showCrz1Picker && (
                                    <div
                                        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 pt-safe"
                                        onClick={() => setShowCrz1Picker(false)}
                                    >
                                        <div
                                            className="glass-card rounded-2xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-center mb-4">
                                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>CRZ 1 시간 선택</h3>
                                            </div>

                                            <div className="flex justify-center mb-4">
                                                <div className="p-1 rounded-xl shadow-lg w-full bg-black/20 backdrop-blur-sm">
                                                    <div className="relative h-32 overflow-hidden">
                                                        {/* 중앙 선택 영역 하이라이트 */}


                                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                                        <div className="absolute top-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-b from-black/50 to-transparent"></div>
                                                        <div className="absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-t from-black/50 to-transparent"></div>

                                                        <div
                                                            ref={crz1PickerRef}
                                                            onScroll={handleCrz1Scroll}
                                                            className={`h-full overflow-y-scroll custom-scrollbar ${isCrz1ScrollingState ? 'scrolling' : ''}`}
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
                                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${isSelected
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
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isDark ? 'bg-gray-600 group-hover:bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`} />
                                                    <span className={`relative z-10 ${isDark ? 'text-white' : 'text-gray-700'}`}>취소</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await handleSaveToFirebase();
                                                        setShowCrz1Picker(false);
                                                    }}
                                                    disabled={isSyncing}
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 group-hover:bg-blue-600'}`} />
                                                    <span className={`relative z-10 ${isSyncing ? 'text-gray-200' : 'text-white'}`}>{isSyncing ? '저장 중...' : '완료'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 이륙 후 드럼 픽커 모달 */}
                                {showAfterTakeoffPicker && (
                                    <div
                                        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 pt-safe"
                                        onClick={() => setShowAfterTakeoffPicker(false)}
                                    >
                                        <div
                                            className="glass-card rounded-2xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-center mb-4">
                                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>이륙 후 시간 선택</h3>
                                            </div>

                                            <div className="flex justify-center mb-4">
                                                <div className="p-1 rounded-xl shadow-lg w-full bg-black/20 backdrop-blur-sm">
                                                    <div className="relative h-32 overflow-hidden">
                                                        {/* 중앙 선택 영역 하이라이트 */}


                                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                                        <div className="absolute top-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-b from-black/50 to-transparent"></div>
                                                        <div className="absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-t from-black/50 to-transparent"></div>

                                                        <div
                                                            ref={afterTakeoffPickerRef}
                                                            onScroll={handleAfterTakeoffScroll}
                                                            className={`h-full overflow-y-scroll custom-scrollbar ${isAfterTakeoffScrollingState ? 'scrolling' : ''}`}
                                                            style={{
                                                                scrollbarWidth: 'thin',
                                                                scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
                                                                msOverflowStyle: 'none'
                                                            }}
                                                        >
                                                            {(() => {
                                                                // 이륙 후 시간 배열 생성
                                                                const AFTER_TAKEOFF_TIMES = [];

                                                                // 5P 모드 여부 확인
                                                                // render loop scope access to activeTab/twoSetMode
                                                                // activeTab and twoSetMode are available in scope
                                                                const step = (activeTab === '2set' && twoSetMode === '5P') ? 1 : 5;

                                                                for (let hour = 0; hour <= 6; hour++) {
                                                                    for (let minute = 0; minute < 60; minute += step) {
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
                                                                        currentValue = threePilotMode === 'CASE2' ? afterTakeoff3PilotCase2 : afterTakeoff3Pilot;
                                                                    } else {
                                                                        currentValue = afterTakeoff;
                                                                    }
                                                                    const isSelected = time === currentAfterTakeoffScrollValue;

                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${isSelected
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
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isDark ? 'bg-gray-600 group-hover:bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`} />
                                                    <span className={`relative z-10 ${isDark ? 'text-white' : 'text-gray-700'}`}>취소</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await handleSaveToFirebase();
                                                        setShowAfterTakeoffPicker(false);
                                                    }}
                                                    disabled={isSyncing}
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 group-hover:bg-blue-600'}`} />
                                                    <span className={`relative z-10 ${isSyncing ? 'text-gray-200' : 'text-white'}`}>{isSyncing ? '저장 중...' : '완료'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}





                                {/* 착륙 전 드럼 픽커 모달 */}
                                {showBeforeLandingPicker && (
                                    <div
                                        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 pt-safe"
                                        onClick={() => setShowBeforeLandingPicker(false)}
                                    >
                                        <div
                                            className="glass-card rounded-2xl shadow-2xl max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full m-2 p-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-center mb-4">
                                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>착륙 전 시간 선택</h3>
                                            </div>

                                            <div className="flex justify-center mb-4">
                                                <div className="p-1 rounded-xl shadow-lg w-full bg-black/20 backdrop-blur-sm">
                                                    <div className="relative h-32 overflow-hidden">
                                                        {/* 중앙 선택 영역 하이라이트 */}


                                                        {/* ✨ [UI 개선] 위아래 그라데이션 마스크 추가 */}
                                                        <div className="absolute top-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-b from-black/50 to-transparent"></div>
                                                        <div className="absolute bottom-0 left-0 w-full h-10 z-20 pointer-events-none bg-gradient-to-t from-black/50 to-transparent"></div>

                                                        <div
                                                            ref={beforeLandingPickerRef}
                                                            onScroll={handleBeforeLandingScroll}
                                                            className={`h-full overflow-y-scroll custom-scrollbar ${isBeforeLandingScrollingState ? 'scrolling' : ''}`}
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
                                                                            className={`h-12 flex items-center justify-center font-mono text-center cursor-pointer snap-start transition-all duration-200 ${isSelected
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
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isDark ? 'bg-gray-600 group-hover:bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`} />
                                                    <span className={`relative z-10 ${isDark ? 'text-white' : 'text-gray-700'}`}>취소</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await handleSaveToFirebase();
                                                        setShowBeforeLandingPicker(false);
                                                    }}
                                                    disabled={isSyncing}
                                                    className="relative px-4 py-2 rounded-xl text-sm transition-colors group"
                                                >
                                                    <div className={`absolute inset-0 rounded-xl transition-colors ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 group-hover:bg-blue-600'}`} />
                                                    <span className={`relative z-10 ${isSyncing ? 'text-gray-200' : 'text-white'}`}>{isSyncing ? '저장 중...' : '완료'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-xl font-bold mb-6 flex items-center">
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
                                            <CalculatorIcon className="inline-block mr-2 text-blue-500" />
                                            비행 정보 입력
                                        </span>
                                    </h2>

                                    {/* 메인 탭 (2SET / 5P / 3PILOT) */}
                                    <div className="glass-panel rounded-xl p-1 flex mb-6">
                                        {INPUT_TABS.map(tab => {
                                            const isActive = inputTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => handleInputTabChange(tab.id)}
                                                    className={`relative flex-1 py-1.5 px-4 rounded-xl text-sm font-bold transition-colors duration-300 z-10 ${isActive
                                                        ? 'text-white'
                                                        : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                                        }`}
                                                >
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="activeInputTab"
                                                            className="absolute inset-0 rounded-xl bg-teal-600 shadow-md shadow-teal-500/30 -z-10"
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                        />
                                                    )}
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 2SET 서브 탭 (2교대 / 1교대) */}
                                    {inputTab === '2set' && (
                                        <div className="flex justify-center mb-6 space-x-4">
                                            {TWO_SET_MODES.map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { twoSetMode: mode.id } })}
                                                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 border ${twoSetMode === mode.id
                                                        ? 'bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400'
                                                        : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                                        }`}
                                                    style={{
                                                        borderRadius: '12px',
                                                        overflow: 'hidden',
                                                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                        maskImage: '-webkit-radial-gradient(white, black)'
                                                    }}
                                                >
                                                    {mode.id}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3PILOT 서브 탭 (CASE 1 / CASE 2) */}
                                    {inputTab === '3pilot' && (
                                        <div className="flex justify-center mb-6 space-x-4">
                                            {THREE_PILOT_MODES.map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => dispatch({ type: 'UPDATE_STATE', payload: { threePilotMode: mode.id } })}
                                                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 border ${threePilotMode === mode.id
                                                        ? 'bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400'
                                                        : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                                        }`}
                                                    style={{
                                                        borderRadius: '12px',
                                                        overflow: 'hidden',
                                                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                        maskImage: '-webkit-radial-gradient(white, black)'
                                                    }}
                                                >
                                                    {mode.id}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {/* 총 비행시간 - 전체 너비 */}
                                        <div>
                                            <label htmlFor="flightTime" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>총 비행시간 (HHMM)</label>
                                            <input
                                                id="flightTime"
                                                type="text"
                                                inputMode="numeric"
                                                value={flightTimeInputDisplayValue}
                                                onFocus={() => setIsFlightTimeInputFocused(true)}
                                                onBlur={() => setIsFlightTimeInputFocused(false)}
                                                onChange={handleTimeInputChange(
                                                    inputTab === '3pilot' ? 'flightTime3Pilot' : inputTab === '5p' ? 'flightTime5P' : 'flightTime'
                                                )}
                                                className="w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                maxLength={isFlightTimeInputFocused ? 4 : 7}
                                                style={{
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                    maskImage: '-webkit-radial-gradient(white, black)'
                                                }}
                                            />
                                            <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {(() => {
                                                    if (inputTab === '3pilot') {
                                                        if (flightTimeMinutes3Pilot <= 0) return null;
                                                        const workTime = flightTimeMinutes3Pilot - Math.floor(flightTimeMinutes3Pilot / 3);
                                                        return `편조별 근무: ${minutesToKoreanDisplay(workTime)} / 휴식: ${minutesToKoreanDisplay(Math.floor(flightTimeMinutes3Pilot / 3))}`;
                                                    } else if (inputTab === '5p') {
                                                        if (flightTimeMinutes5P <= 0) return '총 비행시간을 입력해주세요.';
                                                        return `개인별: ${minutesToKoreanDisplay(fivePTwoFifthsMinutes)}`;
                                                    } else {
                                                        if (flightTimeMinutes2Set <= 0) return null;
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
                                                        className="w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                        maxLength={4}
                                                        style={{
                                                            borderRadius: '12px',
                                                            overflow: 'hidden',
                                                            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                            maskImage: '-webkit-radial-gradient(white, black)'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>Time Zone</label>
                                                    <div
                                                        className="w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg flex items-center justify-center min-h-[44px] cursor-pointer hover:bg-white/10 transition-colors"
                                                        onClick={() => setShowTimeZonePicker(true)}
                                                        style={{
                                                            borderRadius: '12px',
                                                            overflow: 'hidden',
                                                            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                            maskImage: '-webkit-radial-gradient(white, black)'
                                                        }}
                                                    >
                                                        UTC {timeZone >= 0 ? '+' : ''}{timeZone}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-center text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {formatTimeDisplay(convertTime(timeToMinutes(departureTime), timeZone))}L / {formatTimeDisplay(convertTime(timeToMinutes(departureTime), 9))}K
                                            </div>
                                        </div>

                                        {inputTab === '2set' && twoSetMode === '2교대' && (
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

                                        {inputTab === '5p' && (
                                            <>
                                                <div className="grid grid-cols-2 gap-x-4">
                                                    <div>
                                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>이륙 후</label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={afterTakeoff5PDisplayValue}
                                                            onFocus={() => setIsAfterTakeoff5PInputFocused(true)}
                                                            onBlur={() => setIsAfterTakeoff5PInputFocused(false)}
                                                            onChange={(e) => {
                                                                const rawValue = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                                dispatch({ type: 'UPDATE_STATE', payload: { afterTakeoff5P: rawValue } });
                                                            }}
                                                            className="w-full px-3 py-2 glass-input rounded-xl appearance-none text-center font-mono text-lg focus:ring-2 focus:ring-blue-500/50 outline-none min-h-[44px] transition-all"
                                                            maxLength={isAfterTakeoff5PInputFocused ? 4 : 7}
                                                            style={{
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                                maskImage: '-webkit-radial-gradient(white, black)'
                                                            }}
                                                        />
                                                    </div>
                                                    <ReadOnlyDisplay
                                                        label="착륙 전"
                                                        value={minutesToKoreanDisplay(beforeLandingMinutes5P)}
                                                        isDark={isDark}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4">
                                                    <ReadOnlyDisplay
                                                        label="CRZ 1"
                                                        value={minutesToKoreanDisplay(crz1Minutes5P)}
                                                        isDark={isDark}
                                                    />
                                                    <ReadOnlyDisplay
                                                        label="CRZ 2"
                                                        value={minutesToKoreanDisplay(crz2Minutes5P)}
                                                        isDark={isDark}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {inputTab === '2set' && twoSetMode === '1교대' && (
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

                                        {inputTab === '3pilot' && (
                                            <DisplayInput
                                                label="이륙 후"
                                                value={minutesToKoreanDisplay(timeToMinutes(threePilotMode === 'CASE2' ? afterTakeoff3PilotCase2 : afterTakeoff3Pilot))}
                                                onClick={() => setShowAfterTakeoffPicker(true)}
                                                isDark={isDark}
                                            />
                                        )}
                                    </div>







                                    <div className="flex justify-end items-center gap-2 mt-8">
                                        {/* 알림 테스트 버튼 */}
                                        <button
                                            onClick={handleTestNotification}
                                            className="mr-3 text-xs text-gray-400 hover:text-white underline transition-colors"
                                        >
                                            🔔 테스트
                                        </button>

                                        {/* 알람 토글 버튼 */}
                                        <button
                                            onClick={async () => {
                                                const newValue = !isAlarmEnabled;

                                                // 알람 활성화 시 알림 권한 요청 (브라우저 정책상 사용자 인터랙션 내부여야 함)
                                                if (newValue && 'Notification' in window && Notification.permission !== 'granted') {
                                                    try {
                                                        await Notification.requestPermission();
                                                    } catch (error) {
                                                        console.error('알림 권한 요청 실패:', error);
                                                    }
                                                }

                                                setIsAlarmEnabled(newValue);
                                                localStorage.setItem('restAlarmEnabled', String(newValue));
                                            }}
                                            className={`p-2.5 rounded-xl transition-all duration-200 ${isAlarmEnabled
                                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700/70'
                                                }`}
                                            title={isAlarmEnabled ? '알람 활성화됨' : '알람 비활성화됨'}
                                            style={{
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                maskImage: '-webkit-radial-gradient(white, black)'
                                            }}
                                        >
                                            <svg className="w-5 h-5" fill={isAlarmEnabled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                        </button>

                                        {/* 완료 버튼 */}
                                        <button
                                            onClick={handleCompleteEditing}
                                            disabled={isSyncing}
                                            className="glass-button py-2 px-6 rounded-xl font-bold text-sm transition-all duration-200 transform active:scale-95"
                                            style={{
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                maskImage: '-webkit-radial-gradient(white, black)'
                                            }}
                                        >
                                            {isSyncing ? '저장 중...' : '완료'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 알람 모달 */}
            {alarmModal?.isOpen && (
                <RestAlarmModal
                    isOpen={alarmModal.isOpen}
                    periodName={alarmModal.periodName}
                    onDismiss={() => setAlarmModal(null)}
                />
            )}
        </div>
    );
};

export default RestCalculator;
