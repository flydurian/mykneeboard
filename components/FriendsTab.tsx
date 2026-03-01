import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    sendFriendRequest,
    sendFriendRequestByUid,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getUserInfoByUid,
    getAllFlights,
    subscribeFriends,
    subscribeFriendRequests
} from '../src/firebase/database';
import { RefreshCwIcon, XIcon } from './icons';
import { AirlineLogo } from './icons';
import { Flight } from '../types';
import { isKoreanHoliday } from '../utils/holidays';

interface FriendsTabProps {
    user: any;
    myFlights: Flight[];
}

// 친구별 고유 색상 (최대 8명)
const FRIEND_COLORS = [
    { bg: 'bg-emerald-500/25', text: 'text-emerald-300', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
    { bg: 'bg-amber-500/25', text: 'text-amber-300', border: 'border-amber-500/40', dot: 'bg-amber-400' },
    { bg: 'bg-rose-500/25', text: 'text-rose-300', border: 'border-rose-500/40', dot: 'bg-rose-400' },
    { bg: 'bg-cyan-500/25', text: 'text-cyan-300', border: 'border-cyan-500/40', dot: 'bg-cyan-400' },
    { bg: 'bg-purple-500/25', text: 'text-purple-300', border: 'border-purple-500/40', dot: 'bg-purple-400' },
    { bg: 'bg-orange-500/25', text: 'text-orange-300', border: 'border-orange-500/40', dot: 'bg-orange-400' },
    { bg: 'bg-pink-500/25', text: 'text-pink-300', border: 'border-pink-500/40', dot: 'bg-pink-400' },
    { bg: 'bg-lime-500/25', text: 'text-lime-300', border: 'border-lime-500/40', dot: 'bg-lime-400' },
];

const MY_COLOR = { bg: 'bg-indigo-500/25', text: 'text-indigo-300', border: 'border-indigo-500/40', dot: 'bg-indigo-400' };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const FriendsTab: React.FC<FriendsTabProps> = ({ user, myFlights }) => {
    const [email, setEmail] = useState('');
    const [friendsList, setFriendsList] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);

    // 카카오 친구 추천 상태
    const isKakaoUser = user?.uid?.startsWith('kakao:');
    const [kakaoFriends, setKakaoFriends] = useState<any[]>([]);
    const [isLoadingKakao, setIsLoadingKakao] = useState(false);
    const [kakaoError, setKakaoError] = useState('');
    const [sentKakaoRequests, setSentKakaoRequests] = useState<Set<string>>(new Set());

    // 캘린더 상태
    const now = new Date();
    const [calendarMonth, setCalendarMonth] = useState(now.getMonth()); // 0-indexed
    const [calendarYear, setCalendarYear] = useState(now.getFullYear());
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    // 선택된 친구 (체크박스)
    const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
    // 친구별 스케줄 캐시
    const [friendSchedules, setFriendSchedules] = useState<{ [uid: string]: Flight[] }>({});
    const [loadingSchedules, setLoadingSchedules] = useState<Set<string>>(new Set());

    // 친구 UID 변경 시 프로필 정보 로드
    const loadFriendProfiles = useCallback(async (uids: string[]) => {
        if (uids.length === 0) {
            setFriendsList([]);
            setIsFetching(false);
            return;
        }
        setIsFetching(true);
        try {
            const friendsData = await Promise.all(
                uids.map(async (uid) => {
                    const info = await getUserInfoByUid(uid);
                    return { uid, ...info };
                })
            );
            setFriendsList(friendsData.filter(f => f.displayName).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')));
        } catch (error) {
            console.error('프로필 로드 실패:', error);
        } finally {
            setIsFetching(false);
        }
    }, []);

    // 실시간 구독
    useEffect(() => {
        if (!user?.uid) return;

        const unsubFriends = subscribeFriends(user.uid, (uids) => {
            loadFriendProfiles(uids);
        });

        const unsubRequests = subscribeFriendRequests(user.uid, (requestsList) => {
            setRequests(requestsList);
        });

        return () => {
            unsubFriends();
            unsubRequests();
        };
    }, [user?.uid, loadFriendProfiles]);

    // 카카오 친구 추천 목록 로드
    const fetchKakaoFriends = useCallback(async () => {
        if (!user?.uid || !isKakaoUser) return;
        setIsLoadingKakao(true);
        setKakaoError('');
        try {
            const backendOrigin = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
            const response = await fetch(`${backendOrigin}/api/kakao-friends?userId=${encodeURIComponent(user.uid)}`);
            const data = await response.json();
            if (data.success) {
                setKakaoFriends(data.friends || []);
            } else {
                setKakaoError(data.error || '카카오 친구 목록을 불러오지 못했습니다.');
                setKakaoFriends([]);
            }
        } catch (error) {
            console.error('카카오 친구 조회 실패:', error);
            setKakaoError('카카오 친구 목록을 불러오는 중 오류가 발생했습니다.');
            setKakaoFriends([]);
        } finally {
            setIsLoadingKakao(false);
        }
    }, [user?.uid, isKakaoUser]);

    // 카카오 로그인 사용자이면 친구 추천 자동 로드
    useEffect(() => {
        if (isKakaoUser) {
            fetchKakaoFriends();
        }
    }, [isKakaoUser, fetchKakaoFriends]);

    // 카카오 친구에게 친구 요청 보내기
    const handleKakaoFriendRequest = async (friendUid: string) => {
        try {
            const result = await sendFriendRequestByUid(user.uid, user.displayName || '사용자', friendUid);
            if (result.success) {
                setSentKakaoRequests(prev => new Set(prev).add(friendUid));
                setMessage({ text: result.message, type: 'success' });
            } else {
                setMessage({ text: result.message, type: 'error' });
            }
        } catch (error) {
            setMessage({ text: '친구 요청 중 오류가 발생했습니다.', type: 'error' });
        }
    };

    // 친구 스케줄 로드
    const loadFriendSchedule = useCallback(async (uid: string) => {
        if (friendSchedules[uid] || loadingSchedules.has(uid)) return;
        setLoadingSchedules(prev => new Set(prev).add(uid));
        try {
            const flights = await getAllFlights(uid);
            setFriendSchedules(prev => ({ ...prev, [uid]: flights || [] }));
        } catch (error) {
            console.error('친구 스케줄 로드 실패:', error);
            setFriendSchedules(prev => ({ ...prev, [uid]: [] }));
        } finally {
            setLoadingSchedules(prev => {
                const next = new Set(prev);
                next.delete(uid);
                return next;
            });
        }
    }, [friendSchedules, loadingSchedules]);

    // 친구 선택 토글
    const toggleFriend = (uid: string) => {
        setSelectedFriends(prev => {
            const next = new Set(prev);
            if (next.has(uid)) {
                next.delete(uid);
            } else {
                next.add(uid);
                loadFriendSchedule(uid);
            }
            return next;
        });
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const result = await sendFriendRequest(user.uid, user.email, user.displayName || '사용자', email.trim());
            if (result.success) {
                setMessage({ text: result.message, type: 'success' });
                setEmail('');
                setTimeout(() => setShowAddModal(false), 1500);
            } else {
                setMessage({ text: result.message, type: 'error' });
            }
        } catch (error) {
            setMessage({ text: '요청 중 오류가 발생했습니다.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (friendUserId: string) => {
        try {
            await acceptFriendRequest(user.uid, friendUserId);
            setMessage({ text: '친구 요청을 수락했습니다.', type: 'success' });
        } catch (error) {
            setMessage({ text: '수락 중 오류가 발생했습니다.', type: 'error' });
        }
    };

    const handleReject = async (friendUserId: string) => {
        try {
            await rejectFriendRequest(user.uid, friendUserId);
            setMessage({ text: '친구 요청을 처리했습니다.', type: 'info' });
        } catch (error) {
            setMessage({ text: '처리 중 오류가 발생했습니다.', type: 'error' });
        }
    };

    const handleRemoveFriend = async (friendUid: string) => {
        try {
            await removeFriend(user.uid, friendUid);
            setSelectedFriends(prev => {
                const next = new Set(prev);
                next.delete(friendUid);
                return next;
            });
            setFriendSchedules(prev => {
                const next = { ...prev };
                delete next[friendUid];
                return next;
            });
            setConfirmRemoveUid(null);
        } catch (error) {
            console.error('친구 해제 실패:', error);
        }
    };

    // ---- 캘린더 로직 ----
    const getCalendarDays = (year: number, month: number) => {
        const firstDay = new Date(year, month, 1).getDay(); // 0=일, 6=토
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];

        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);

        // 나머지 채우기 (7의 배수)
        while (days.length % 7 !== 0) days.push(null);

        return days;
    };

    // 날짜 기준 스케줄 그룹핑
    const getFlightsByDate = (flights: Flight[], year: number, month: number): { [day: number]: Flight[] } => {
        const map: { [day: number]: Flight[] } = {};
        flights.forEach(f => {
            if (!f.date) return;
            const d = new Date(f.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                if (!map[day]) map[day] = [];
                map[day].push(f);
            }
        });
        return map;
    };

    // 스케줄 표시 텍스트 추출
    const getScheduleLabel = (flight: Flight): string => {
        const fn = (flight.flightNumber || '').toUpperCase();
        const st = (flight.scheduleType || '').toUpperCase();

        // 비행편 — 행선지 표시
        if (flight.route) {
            const parts = flight.route.split('/');
            const dest = parts.length > 1 ? parts[1] : parts[0];
            if (dest) return dest;
        }

        // 휴가 스케줄
        if (fn.includes('ANNUAL LEAVE') || fn.includes('ALV') || fn.includes('ALM') ||
            fn.includes('VAC_R') || fn.includes('VAC') || st === 'ANNUAL_LEAVE') {
            return '휴가';
        }

        // 스탠바이
        if (fn.includes('STBY') || fn.includes('RESERVE') || st === 'STANDBY') {
            return 'STBY';
        }

        // OTHRDUTY / OFFICE
        if (fn.includes('OTHRDUTY') || fn.includes('OFFICE') || st === 'OTHRDUTY') {
            return 'DUTY';
        }

        // SIM
        if (fn.includes('SIM')) {
            return 'SIM';
        }

        // RDO (OFF)
        if (st === 'RDO' || fn.includes('RDO')) {
            return 'OFF';
        }

        // 교육/점검 등 특별 스케줄
        if (fn.includes('G/S') || fn.includes('GS') || fn.includes('GROUND SCHOOL')) return 'G/S';
        if (fn.includes('MEDICAL')) return 'MED';
        if (fn.includes('TRAINING') || fn.includes('교육')) return '교육';
        if (fn.includes('BRIEFING') || fn.includes('브리핑')) return 'BRF';
        if (fn.includes('MEETING') || fn.includes('회의') || fn.includes('안전회의') || fn.includes('SAFETY')) return '회의';
        if (fn.includes('CHECK') || fn.includes('점검') || fn.includes('INSPECTION') || fn.includes('검사')) return '점검';

        // 기타 — flightNumber 그대로
        return flight.flightNumber || '';
    };

    const calendarDays = getCalendarDays(calendarYear, calendarMonth);
    const myFlightsByDate = getFlightsByDate(myFlights, calendarYear, calendarMonth);

    // 선택된 친구들의 날짜별 스케줄
    const selectedFriendsList = friendsList.filter(f => selectedFriends.has(f.uid));
    const friendFlightsByDate: { [uid: string]: { [day: number]: Flight[] } } = {};
    selectedFriendsList.forEach(f => {
        if (friendSchedules[f.uid]) {
            friendFlightsByDate[f.uid] = getFlightsByDate(friendSchedules[f.uid], calendarYear, calendarMonth);
        }
    });

    // 친구 색상 매핑
    const friendColorMap: { [uid: string]: typeof FRIEND_COLORS[0] } = {};
    selectedFriendsList.forEach((f, i) => {
        friendColorMap[f.uid] = FRIEND_COLORS[i % FRIEND_COLORS.length];
    });

    const isThisMonth = calendarMonth === thisMonth && calendarYear === thisYear;
    const isNextMonth = calendarMonth === nextMonth && calendarYear === nextMonthYear;

    const monthLabel = `${calendarYear}년 ${calendarMonth + 1}월`;

    return (
        <div className="space-y-4">
            {/* 카카오 친구 추천 */}
            {isKakaoUser && (
                <section className="glass-panel rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ backgroundColor: '#FEE500' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 3C6.47715 3 2 6.58172 2 11C2 13.8443 3.49653 16.34 5.76011 17.8444L4.85106 21.0567C4.77382 21.3298 5.06173 21.5645 5.31175 21.4395L8.72917 19.7303C9.76174 19.9079 10.8522 20 12 20C17.5228 20 22 16.4183 22 12C22 7.58172 17.5228 4 12 4V3Z" fill="#000" />
                                </svg>
                            </span>
                            카카오 친구 추천
                        </h3>
                        <button
                            onClick={fetchKakaoFriends}
                            disabled={isLoadingKakao}
                            className={`p-1.5 text-gray-400 hover:text-white transition-all rounded-lg hover:bg-white/10 ${isLoadingKakao ? 'animate-spin' : ''}`}
                        >
                            <RefreshCwIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {isLoadingKakao ? (
                        <div className="text-center py-3">
                            <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto text-yellow-500 mb-1" />
                            <p className="text-gray-500 text-xs">카카오 친구 검색 중...</p>
                        </div>
                    ) : kakaoError ? (
                        <p className="text-center py-2 text-red-400 text-xs">{kakaoError}</p>
                    ) : kakaoFriends.length === 0 ? (
                        <p className="text-center py-2 text-gray-500 text-xs">앱을 사용하는 카카오 친구가 없습니다</p>
                    ) : (
                        <div className="space-y-2">
                            {kakaoFriends.map((friend) => {
                                const isSent = sentKakaoRequests.has(friend.uid);
                                return (
                                    <div key={friend.uid} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                        {/* 프로필 이미지 */}
                                        {friend.kakaoProfileImage ? (
                                            <img
                                                src={friend.kakaoProfileImage}
                                                alt=""
                                                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center flex-shrink-0">
                                                <span className="text-white text-sm font-bold">
                                                    {(friend.displayName || '?').charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        {/* 정보 */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-medium text-sm truncate">{friend.displayName}</p>
                                                {friend.company && (
                                                    <AirlineLogo airline={friend.company} className="flex-shrink-0 w-4 h-4" />
                                                )}
                                            </div>
                                            {friend.kakaoNickname && friend.kakaoNickname !== friend.displayName && (
                                                <p className="text-xs text-gray-500 truncate">카카오: {friend.kakaoNickname}</p>
                                            )}
                                        </div>
                                        {/* 친구 추가 버튼 */}
                                        <button
                                            onClick={() => handleKakaoFriendRequest(friend.uid)}
                                            disabled={isSent}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${isSent
                                                    ? 'bg-gray-600/20 text-gray-500 cursor-not-allowed'
                                                    : 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400'
                                                }`}
                                        >
                                            {isSent ? '요청 완료' : '친구 추가'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* 받은 친구 요청 */}
            <AnimatePresence>
                {requests.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel rounded-2xl p-4 border-l-4 border-indigo-500"
                    >
                        <h3 className="text-sm font-semibold mb-3 text-indigo-400">
                            받은 친구 요청 ({requests.length})
                        </h3>
                        <div className="space-y-2">
                            {requests.map((req) => (
                                <div key={req.friendUserId} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm truncate">{req.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{req.email}</p>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                        <button
                                            onClick={() => handleAccept(req.friendUserId)}
                                            className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-1 rounded-lg text-xs transition-all"
                                        >
                                            수락
                                        </button>
                                        <button
                                            onClick={() => handleReject(req.friendUserId)}
                                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1 rounded-lg text-xs transition-all"
                                        >
                                            거절
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* 내 친구 + 추가 버튼 */}
            <section className="glass-panel rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        내 친구
                        <span className="text-xs text-gray-400">({friendsList.length})</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { if (user?.uid) loadFriendProfiles(friendsList.map(f => f.uid)); }}
                            className={`p-1.5 text-gray-400 hover:text-white transition-all rounded-lg hover:bg-white/10 ${isFetching ? 'animate-spin' : ''}`}
                        >
                            <RefreshCwIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { setShowAddModal(true); setMessage({ text: '', type: '' }); }}
                            className="w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/20 text-lg font-bold leading-none"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* 친구 목록 */}
                {isFetching && friendsList.length === 0 ? (
                    <div className="text-center py-3">
                        <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-1" />
                        <p className="text-gray-500 text-xs">불러오는 중...</p>
                    </div>
                ) : friendsList.length === 0 ? (
                    <p className="text-center py-2 text-gray-500 text-xs">+ 버튼으로 친구를 추가하세요</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {friendsList.map((friend, idx) => {
                            const isSelected = selectedFriends.has(friend.uid);
                            const color = isSelected ? friendColorMap[friend.uid] || FRIEND_COLORS[idx % FRIEND_COLORS.length] : null;
                            const isConfirming = confirmRemoveUid === friend.uid;
                            return (
                                <div
                                    key={friend.uid}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all border cursor-pointer ${isSelected
                                        ? `${color!.bg} ${color!.border} border`
                                        : 'bg-white/5 border-transparent hover:bg-white/10'
                                        }`}
                                    onClick={() => !isConfirming && toggleFriend(friend.uid)}
                                >
                                    {/* 체크박스 */}
                                    <div className={`w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? `${color!.dot} border-transparent` : 'border-gray-500'}`}>
                                        {isSelected && (
                                            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="font-medium text-xs text-gray-200 truncate flex-1 min-w-0">
                                        {friend.displayName}
                                    </span>
                                    {friend.company && (
                                        <AirlineLogo airline={friend.company} className="flex-shrink-0 w-3.5 h-3.5" />
                                    )}
                                    {/* 로딩 */}
                                    {isSelected && loadingSchedules.has(friend.uid) && (
                                        <RefreshCwIcon className="w-2.5 h-2.5 animate-spin text-gray-400 flex-shrink-0" />
                                    )}
                                    {/* 삭제 확인 */}
                                    {isConfirming ? (
                                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleRemoveFriend(friend.uid)}
                                                className="text-[9px] bg-red-600/30 hover:bg-red-600/50 text-red-400 px-1 py-0.5 rounded transition-all"
                                            >
                                                해제
                                            </button>
                                            <button
                                                onClick={() => setConfirmRemoveUid(null)}
                                                className="text-[9px] bg-white/10 hover:bg-white/20 text-gray-400 px-1 py-0.5 rounded transition-all"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmRemoveUid(friend.uid); }}
                                            className="p-0.5 text-gray-600 hover:text-red-400 transition-all flex-shrink-0"
                                            title="친구 해제"
                                        >
                                            <XIcon className="w-2.5 h-2.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 스케줄 비교 캘린더 */}
            <section className="glass-panel rounded-2xl p-4">
                {/* 월 선택 탭 */}
                <div className="flex items-center gap-2 mb-4">
                    <button
                        onClick={() => { setCalendarMonth(thisMonth); setCalendarYear(thisYear); }}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${isThisMonth
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        이번 달
                    </button>
                    <button
                        onClick={() => { setCalendarMonth(nextMonth); setCalendarYear(nextMonthYear); }}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${isNextMonth
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        다음 달
                    </button>
                </div>

                {/* 월 타이틀 */}
                <h3 className="text-center text-sm font-semibold text-gray-300 mb-3">{monthLabel}</h3>

                {/* 범례 */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${MY_COLOR.dot}`} />
                        <span className="text-xs text-gray-400">나</span>
                    </div>
                    {selectedFriendsList.map(f => (
                        <div key={f.uid} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${friendColorMap[f.uid]?.dot}`} />
                            <span className="text-xs text-gray-400">{f.displayName}</span>
                        </div>
                    ))}
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAYS.map((day, i) => (
                        <div key={day} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
                            }`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* 캘린더 그리드 */}
                <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="min-h-[48px]" />;
                        }

                        const today = new Date();
                        const isToday = day === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
                        const dayOfWeek = new Date(calendarYear, calendarMonth, day).getDay();
                        const isHoliday = isKoreanHoliday(new Date(calendarYear, calendarMonth, day));
                        const myDayFlights = myFlightsByDate[day] || [];

                        // 친구들 스케줄
                        const friendEntries: { uid: string; name: string; flights: Flight[]; color: typeof FRIEND_COLORS[0] }[] = [];
                        selectedFriendsList.forEach(f => {
                            const fFlights = friendFlightsByDate[f.uid]?.[day] || [];
                            if (fFlights.length > 0) {
                                friendEntries.push({
                                    uid: f.uid,
                                    name: f.displayName,
                                    flights: fFlights,
                                    color: friendColorMap[f.uid]
                                });
                            }
                        });

                        return (
                            <div
                                key={`day-${day}`}
                                className={`min-h-[48px] rounded-lg p-0.5 border transition-all ${isToday ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 bg-white/[0.02]'
                                    }`}
                            >
                                {/* 날짜 숫자 */}
                                <div className={`text-xs font-medium px-1 mb-0.5 ${isToday ? 'text-indigo-400 font-bold' :
                                    (isHoliday || dayOfWeek === 0) ? 'text-red-400' :
                                        dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'
                                    }`}>
                                    {day}
                                </div>

                                {/* 내 스케줄 */}
                                {myDayFlights.map((f, i) => (
                                    <div key={`my-${i}`} className={`${MY_COLOR.bg} ${MY_COLOR.text} text-[10px] leading-tight rounded px-0.5 py-px mb-px truncate`}>
                                        {getScheduleLabel(f)}
                                    </div>
                                ))}

                                {/* 친구 스케줄 */}
                                {friendEntries.map(entry => (
                                    entry.flights.map((f, i) => (
                                        <div key={`${entry.uid}-${i}`} className={`${entry.color.bg} ${entry.color.text} text-[10px] leading-tight rounded px-0.5 py-px mb-px truncate`}>
                                            {getScheduleLabel(f)}
                                        </div>
                                    ))
                                ))}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 친구 추가 팝업 모달 */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-panel rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-semibold">친구 추가</h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-1 text-gray-400 hover:text-white transition-all rounded-lg hover:bg-white/10"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSendRequest}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="친구의 이메일 주소"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm mb-3"
                                    disabled={isLoading}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !email.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 text-sm"
                                >
                                    {isLoading ? <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto" /> : '친구 요청 보내기'}
                                </button>
                                {message.text && (
                                    <p className={`mt-3 text-sm text-center ${message.type === 'success' ? 'text-green-400' :
                                        message.type === 'error' ? 'text-red-400' : 'text-gray-400'
                                        }`}>
                                        {message.text}
                                    </p>
                                )}
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FriendsTab;
