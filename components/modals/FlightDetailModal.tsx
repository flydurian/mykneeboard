import React, { useState, useRef, useEffect } from 'react';
import { Flight } from '../../types';
import { XIcon, MemoIcon } from '../icons';
import { parse, subMinutes, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { networkDetector } from '../../utils/networkDetector';
import { getCityInfo, getAirportsByCountry } from '../../utils/cityData';
import { isActualFlight } from '../../utils/helpers';

// 연필 아이콘 컴포넌트
const EditIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// 삭제 아이콘 컴포넌트
const DeleteIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

interface FlightDetailModalProps {
    flight: Flight | null;
    onClose: () => void;
    onUpdateStatus: (flightId: number, statusToToggle: 'departed' | 'landed') => void;
    onStatusChange?: (flightId: string, status: Partial<{ departed: boolean; landed: boolean }>) => void;
    flightType?: 'last' | 'next'; // 추가: 비행 타입
    currentUser?: { displayName: string | null; empl?: string; userName?: string; company?: string } | null; // 현재 사용자 정보 추가 (EMPL, userName, company 포함)
    onCrewClick: (crewName: string, empl?: string, crewType?: 'flight' | 'cabin') => void;
    onMemoClick?: (crewName: string) => void; // ✨ 메모 클릭 핸들러 추가
    onAirportClick: (airportCode: string) => void; // ✨ 공항 코드 클릭 핸들러 추가
    onEditFlight?: (flight: Flight) => void; // ✨ 수정 핸들러 추가
    onDeleteFlight?: (flightId: number) => void; // ✨ 삭제 핸들러 추가
}

const FlightDetailModal: React.FC<FlightDetailModalProps> = ({ flight, onClose, onUpdateStatus, onStatusChange, flightType, currentUser, onCrewClick, onMemoClick, onAirportClick, onEditFlight, onDeleteFlight }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingCrew, setEditingCrew] = useState<string | null>(null);
    const [newCrewMember, setNewCrewMember] = useState({ empl: '', name: '', rank: '', posnType: '', posn: '', gisu: '' });
    const [editingRegNo, setEditingRegNo] = useState<string>('');
    const [isCabinCrewExpanded, setIsCabinCrewExpanded] = useState(false);
    const [timeDisplayMode, setTimeDisplayMode] = useState<'local' | 'utc' | 'kst'>('local'); // L/Z/K 버튼 상태
    const [cabinCrewList, setCabinCrewList] = useState(() => {
        if (flight?.cabinCrew) {
            return Array.isArray(flight.cabinCrew) ? flight.cabinCrew : Object.values(flight.cabinCrew);
        }
        return [];
    });
    const [newCabinCrewMember, setNewCabinCrewMember] = useState({ empl: '', name: '', rank: '', gisu: '' });
    const [crewList, setCrewList] = useState(() => {
        if (flight?.crew) {
            return Array.isArray(flight.crew) ? flight.crew : Object.values(flight.crew);
        }
        return [];
    });

    // flight 데이터가 변경될 때마다 crewList 업데이트
    useEffect(() => {
        if (flight?.crew) {
            // Firebase에서 오는 crew 데이터가 객체인 경우 배열로 변환
            const crewArray = Array.isArray(flight.crew) ? flight.crew : Object.values(flight.crew);
            setCrewList(crewArray);
        } else {
            setCrewList([]);
        }
    }, [flight?.crew, flight?.id]); // flight.id도 의존성에 추가하여 전체 flight 변경 시 반영

    // flight 데이터가 변경될 때마다 cabinCrewList 업데이트
    useEffect(() => {
        if (flight?.cabinCrew) {
            // Firebase에서 오는 cabinCrew 데이터가 객체인 경우 배열로 변환
            const cabinCrewArray = Array.isArray(flight.cabinCrew) ? flight.cabinCrew : Object.values(flight.cabinCrew);
            setCabinCrewList(cabinCrewArray);
        } else {
            setCabinCrewList([]);
        }
    }, [flight?.cabinCrew, flight?.id]);

    if (!flight) return null;

    const isStandby = flight.flightNumber.includes('STBY') || 
                      flight.flightNumber.includes('RESERVE') || 
                      flight.flightNumber.includes('OTHRDUTY') || 
                      flight.flightNumber.includes('HM SBY') ||
                      flight.flightNumber.includes('HM_SBY') ||
                      flight.scheduleType === 'STANDBY';
    const isSimSchedule = flight.flightNumber.toUpperCase().includes('SIM');
    const isSpecialScheduleType = flight.flightNumber.toUpperCase().includes('G/S STUDENT') ||
                                  flight.flightNumber.toUpperCase().includes('GS STUDENT') ||
                                  flight.flightNumber.toUpperCase().includes('G/S') ||
                                  flight.flightNumber.toUpperCase().includes('GS') ||
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
    const standbyTime = flight.flightNumber === 'A STBY' ? '04:00 - 16:00' : '09:00 - 21:00';

    const isSpecialSchedule = isStandby || isSpecialScheduleType;
    
    // 7C 스케줄의 특별 스케줄과 휴가 스케줄 구분
    const is7CSpecialSchedule = flight.scheduleType === '7C' && (
        flight.flightNumber.toUpperCase().includes('GROUND SCHOOL') ||
        flight.flightNumber.toUpperCase().includes('R_SIM1') ||
        flight.flightNumber.toUpperCase().includes('R_SIM2') ||
        flight.flightNumber.toUpperCase().includes('BKK') ||
        flight.flightNumber.toUpperCase().includes('LAYOV')
    );
    const is7CVacationSchedule = flight.scheduleType === '7C' && (
        flight.flightNumber.toUpperCase().includes('VAC_R') ||
        flight.flightNumber.toUpperCase().includes('VAC')
    );

    // SHOW UP 시간 계산 (한국 공항 출발편에만) - UTC 기준으로 저장된 데이터를 로컬 시간으로 변환
    let showUpTime = null;
    if (
      (!isSpecialSchedule || is7CSpecialSchedule || is7CVacationSchedule) &&
      flight.showUpDateTimeUtc
    ) {
      try {
        // 한국 공항 목록
        const koreanAirports = getAirportsByCountry('South Korea');
        
        // 출발 공항이 한국 공항인지 확인
        const departureAirport = flight.route?.split('/')[0];
        const isKoreanDeparture = departureAirport && koreanAirports.includes(departureAirport.toUpperCase());
        
        if (isKoreanDeparture) {
          // UTC로 저장된 데이터를 한국 시간으로 변환
          const showUpUtc = new Date(flight.showUpDateTimeUtc);
          showUpTime = formatInTimeZone(showUpUtc, 'Asia/Seoul', 'HH:mm');
        }
      } catch (error) {
        console.error('Show up time calculation error:', error);
        // 파싱 실패 시 showUpTime은 null로 유지
      }
    }

    // 상태 업데이트를 처리하는 함수
    const handleUpdateStatus = async (statusField: 'departed' | 'landed') => {
        if (isUpdating) return; // 이미 업데이트 중이면 중복 실행 방지
        setIsUpdating(true);

        
        if (!flight.id) {
            console.error('FlightDetailModal - flight.id가 없음:', flight);
            alert(`오류: 항공편 ID가 없어 업데이트할 수 없습니다.\n항공편 번호: ${flight.flightNumber}\n날짜: ${flight.date}`);
            setIsUpdating(false);
            return;
        }
        
        try {
            // await를 제거하여 즉시 반응하도록 수정
            onUpdateStatus(flight.id, statusField).catch(e => {
                console.error("FlightDetailModal - 업데이트 실패:", e);
                alert('상태 업데이트 중 오류가 발생했습니다.');
            });
        } catch (e) {
            console.error("FlightDetailModal - 업데이트 실패:", e);
            alert('상태 업데이트 중 오류가 발생했습니다.');
        } finally {
            // 즉시 로딩 상태 해제
            setTimeout(() => setIsUpdating(false), 100);
        }
    };

    // 수정 핸들러
    const handleEditFlight = () => {
        if (isEditMode) {
            // 수정 모드에서 실제 수정 로직 실행
            if (onEditFlight) {
                // crew 배열을 객체로 변환 (Firebase 형식에 맞춤)
                const crewObject = {};
                crewList.forEach((member, index) => {
                    crewObject[index] = member;
                });
                
                // cabinCrew 배열을 객체로 변환 (Firebase 형식에 맞춤)
                const cabinCrewObject = {};
                cabinCrewList.forEach((member, index) => {
                    cabinCrewObject[index] = member;
                });
                
                // version 업데이트 (수정사항이 있을 때마다)
                const updatedFlight = { 
                    ...flight, 
                    crew: crewObject,
                    cabinCrew: cabinCrewObject,
                    regNo: editingRegNo.trim() || null,
                    version: (flight.version || 0) + 1,
                    lastModified: new Date().toISOString()
                };
                
                onEditFlight(updatedFlight);
                onClose();
            }
        } else {
            // 수정 모드로 전환 - 기존 승무원 데이터를 배열로 변환
            const crewArray = flight.crew ? Object.values(flight.crew) : [];
            const cabinCrewArray = flight.cabinCrew ? Object.values(flight.cabinCrew) : [];
            setCrewList(crewArray);
            setCabinCrewList(cabinCrewArray);
            setEditingRegNo(flight.regNo || '');
            setIsEditMode(true);
        }
    };

    // 수정 모드 취소 핸들러
    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditingCrew(null);
        setNewCrewMember({ empl: '', name: '', rank: '', posnType: '', posn: '', gisu: '' });
        setEditingRegNo('');
        setNewCabinCrewMember({ empl: '', name: '', rank: '', gisu: '' });
        // 기존 승무원 데이터로 복원
        const crewArray = flight.crew ? Object.values(flight.crew) : [];
        const cabinCrewArray = flight.cabinCrew ? Object.values(flight.cabinCrew) : [];
        setCrewList(crewArray);
        setCabinCrewList(cabinCrewArray);
    };

    // 승무원 편집 시작
    const handleEditCrew = (empl: string) => {
        setEditingCrew(empl);
        const crewMember = crewList.find(c => c.empl === empl);
        if (crewMember) {
            setNewCrewMember({
                empl: crewMember.empl,
                name: crewMember.name,
                rank: crewMember.rank,
                posnType: crewMember.posnType,
                posn: crewMember.posn,
                gisu: crewMember.gisu || ''
            });
        }
    };

    // 승무원 편집 저장 (기존 데이터 유지하면서 편집)
    const handleSaveCrewEdit = async () => {
        if (editingCrew) {
            // 기존 crew 객체 가져오기 (Firebase 원본 데이터)
            const existingCrewObject = flight?.crew || {};
            
            // 해당 EMPL을 가진 승무원의 인덱스 찾기
            const crewIndex = Object.keys(existingCrewObject).find(index => 
                existingCrewObject[index]?.empl === editingCrew
            );
            
            if (crewIndex !== undefined) {
                // 기존 crew 객체에서 해당 인덱스의 승무원만 편집
                const updatedCrewObject = {
                    ...existingCrewObject,
                    [crewIndex]: { ...existingCrewObject[crewIndex], ...newCrewMember }
                };
                
                // UI용 배열로 변환
                const updatedCrewList = Object.values(updatedCrewObject);
                setCrewList(updatedCrewList);
                setEditingCrew(null);
                setNewCrewMember({ empl: '', name: '', rank: '', posnType: '', posn: '' });
                
                // 즉시 Firebase에 저장
                if (onEditFlight) {
                    // 이미 올바른 객체 형식이므로 그대로 사용
                    const crewObject = updatedCrewObject;
                
                
                // version 업데이트 (수정사항이 있을 때마다)
                const updatedFlight = { 
                    ...flight, 
                    crew: crewObject,
                    version: (flight.version || 0) + 1,
                    lastModified: new Date().toISOString()
                };
                
                try {
                    await onEditFlight(updatedFlight);
                    
                    // 🔄 성공 시 crewList 상태도 업데이트 (UI 즉시 반영)
                    setCrewList(updatedCrewList);
                } catch (error) {
                    console.error('❌ 저장 실패:', error);
                    alert('저장 중 오류가 발생했습니다.');
                    // 저장 실패 시 crewList 복원
                    setCrewList(Object.values(existingCrewObject));
                }
            }
            
            }
        }
    };

    // 승무원 편집 취소
    const handleCancelCrewEdit = () => {
        setEditingCrew(null);
        setNewCrewMember({ empl: '', name: '', rank: '', posnType: '', posn: '' });
    };

    // 승무원 삭제 (기존 데이터 유지하면서 삭제)
    const handleDeleteCrew = async (empl: string) => {
        // 기존 crew 객체 가져오기 (Firebase 원본 데이터)
        const existingCrewObject = flight?.crew || {};
        
        // 해당 EMPL을 가진 승무원의 인덱스 찾기
        const crewIndexToDelete = Object.keys(existingCrewObject).find(index => 
            existingCrewObject[index]?.empl === empl
        );
        
        if (crewIndexToDelete !== undefined) {
            // 해당 인덱스의 승무원을 삭제하고 객체에서 제거
            const { [crewIndexToDelete]: deleted, ...remainingCrewObject } = existingCrewObject;
            
            // UI용 배열로 변환
            const updatedCrewList = Object.values(remainingCrewObject);
            setCrewList(updatedCrewList);
            
            // 즉시 Firebase에 저장
            if (onEditFlight) {
                // 이미 올바른 객체 형식이므로 그대로 사용
                const crewObject = remainingCrewObject;
            
            
            // version 업데이트 (수정사항이 있을 때마다)
            const updatedFlight = { 
                ...flight, 
                crew: crewObject,
                version: (flight.version || 0) + 1,
                lastModified: new Date().toISOString()
            };
            
            try {
                await onEditFlight(updatedFlight);
                
                // 🔄 성공 시 crewList 상태도 업데이트 (UI 즉시 반영)
                setCrewList(updatedCrewList);
            } catch (error) {
                console.error('❌ 저장 실패:', error);
                alert('저장 중 오류가 발생했습니다.');
                // 저장 실패 시 crewList 복원
                setCrewList(Object.values(existingCrewObject));
            }
        }
        }
    };

    // 새 승무원 추가 (기존 데이터 유지하면서 추가)
    const handleAddCrewMember = async () => {
        if (newCrewMember.empl && newCrewMember.name && newCrewMember.rank && newCrewMember.posnType && newCrewMember.posn) {
            // 기존 crew 데이터 가져오기 (Firebase에서 온 원본 데이터)
            const existingCrewArray = flight?.crew ? 
                (Array.isArray(flight.crew) ? flight.crew : Object.values(flight.crew)) : [];
            
            // 중복 EMPL 확인 (기존 데이터와 현재 crewList 모두 확인)
            const isDuplicate = [...existingCrewArray, ...crewList].some(crew => crew.empl === newCrewMember.empl);
            if (isDuplicate) {
                alert('이미 존재하는 EMPL 번호입니다.');
                return;
            }
            
            // 새 승무원 추가 (Firebase 구조에 맞춤)
            const newMember = {
                empl: newCrewMember.empl,
                name: newCrewMember.name,
                rank: newCrewMember.rank,
                posnType: newCrewMember.posnType,
                posn: newCrewMember.posn,
                gisu: newCrewMember.gisu || ''
            };
            
            // 기존 crew 객체에서 마지막 인덱스 찾기
            const existingCrewObject = flight?.crew || {};
            const existingIndices = Object.keys(existingCrewObject).map(Number).sort((a, b) => a - b);
            const lastIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : -1;
            const nextIndex = lastIndex + 1;
            
            // 기존 crew 객체에 새 승무원 추가 (순차적 인덱스 유지)
            const updatedCrewObject = {
                ...existingCrewObject,
                [nextIndex]: newMember
            };
            
            // UI용 배열로 변환
            const updatedCrewList = Object.values(updatedCrewObject);
            setCrewList(updatedCrewList);
            setNewCrewMember({ empl: '', name: '', rank: '', posnType: '', posn: '', gisu: '' });
            
            // 즉시 Firebase에 저장
            if (onEditFlight) {
                // 이미 올바른 객체 형식이므로 그대로 사용
                const crewObject = updatedCrewObject;
                
                
                // version 업데이트 (수정사항이 있을 때마다)
                const updatedFlight = { 
                    ...flight, 
                    crew: crewObject,
                    version: (flight.version || 0) + 1,
                    lastModified: new Date().toISOString()
                };
                
                try {
                    await onEditFlight(updatedFlight);
                    
                    // 🔄 성공 시 crewList 상태도 업데이트 (UI 즉시 반영)
                    setCrewList(updatedCrewList);
                } catch (error) {
                    console.error('❌ 저장 실패:', error);
                    alert('저장 중 오류가 발생했습니다.');
                    // 저장 실패 시 crewList 복원
                    setCrewList(existingCrewArray);
                }
            }
            
        } else {
            alert('모든 필드를 입력해주세요.');
        }
    };

    // 삭제 핸들러 (실제 삭제 실행)
    const handleDeleteFlight = async () => {
        if (!onDeleteFlight || !flight.id) return;
        
        try {
            await onDeleteFlight(flight.id);
            onClose();
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    // 삭제 확인 핸들러 (확인 모달 표시)
    const handleDeleteConfirm = () => {
        setShowDeleteConfirm(true);
        setDeleteConfirmCount(0);
    };

    // 삭제 확인 버튼 클릭 (이중 확인)
    const handleDeleteConfirmClick = () => {
        if (deleteConfirmCount === 0) {
            setDeleteConfirmCount(1);
        } else {
            // 두 번째 클릭 시 실제 삭제 실행
            handleDeleteFlight();
        }
    };

    // 삭제 취소 핸들러
    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setDeleteConfirmCount(0);
    };

    // 객실 승무원 추가 함수
    const handleAddCabinCrewMember = async () => {
        if (newCabinCrewMember.empl && newCabinCrewMember.name && newCabinCrewMember.rank) {
            // 중복 EMPL 확인
            const isDuplicate = cabinCrewList.some(crew => crew.empl === newCabinCrewMember.empl);
            if (isDuplicate) {
                alert('이미 존재하는 EMPL 번호입니다.');
                return;
            }
            
            // 새 객실 승무원 추가
            const newMember = {
                empl: newCabinCrewMember.empl,
                name: newCabinCrewMember.name,
                rank: newCabinCrewMember.rank,
                gisu: newCabinCrewMember.gisu ? newCabinCrewMember.gisu.trim().toUpperCase() : '',
                posnType: '', // 객실 승무원은 posnType과 posn이 없음
                posn: ''
            };
            
            const updatedCabinCrewList = [...cabinCrewList, newMember];
            setCabinCrewList(updatedCabinCrewList);
            setNewCabinCrewMember({ empl: '', name: '', rank: '', gisu: '' });
            
            // Firebase에 즉시 저장
            if (onEditFlight) {
                const cabinCrewObject = {};
                updatedCabinCrewList.forEach((member, index) => {
                    cabinCrewObject[index] = member;
                });
                
                const updatedFlight = {
                    ...flight,
                    cabinCrew: cabinCrewObject,
                    lastModified: new Date().toISOString(),
                    version: (flight.version || 0) + 1
                };
                
                try {
                    await onEditFlight(updatedFlight);
                } catch (error) {
                    console.error('❌ 객실 승무원 저장 실패:', error);
                    alert('저장 중 오류가 발생했습니다.');
                    // 저장 실패 시 원래 상태로 복원
                    setCabinCrewList(cabinCrewList);
                }
            }
        } else {
            alert('모든 필드를 입력해주세요.');
        }
    };

    // 객실 승무원 삭제 함수
    const handleDeleteCabinCrew = async (empl: string) => {
        const updatedCabinCrewList = cabinCrewList.filter(member => member.empl !== empl);
        setCabinCrewList(updatedCabinCrewList);
        
        // Firebase에 즉시 저장
        if (onEditFlight) {
            const cabinCrewObject = {};
            updatedCabinCrewList.forEach((member, index) => {
                cabinCrewObject[index] = member;
            });
            
            const updatedFlight = {
                ...flight,
                cabinCrew: cabinCrewObject,
                lastModified: new Date().toISOString(),
                version: (flight.version || 0) + 1
            };
            
            try {
                await onEditFlight(updatedFlight);
            } catch (error) {
                console.error('❌ 객실 승무원 삭제 실패:', error);
                alert('삭제 중 오류가 발생했습니다.');
                // 삭제 실패 시 원래 상태로 복원
                setCabinCrewList(cabinCrewList);
            }
        }
    };

    const containerClasses = `bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] relative animate-fade-in-up flex flex-col ${isSpecialSchedule ? 'justify-center min-h-[150px]' : ''}`;


    // 비행이 과거인지(출발 시간이 현재 시각 이전인지) 판단
    const isPastByTime = (() => {
        try {
            if (flight?.departureDateTimeUtc) {
                return new Date(flight.departureDateTimeUtc).getTime() <= Date.now();
            }
            if (flight?.date) {
                // 시간 정보가 없으면 해당 날짜의 말(로컬)까지를 과거로 간주
                const endOfDayLocal = new Date(`${flight.date}T23:59:59`);
                return endOfDayLocal.getTime() <= Date.now();
            }
            return false;
        } catch {
            return false;
        }
    })();


    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center overflow-y-auto z-[70] p-2 sm:p-4 pt-safe" onClick={onClose}>
            <div className={containerClasses} style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px)' }} onClick={(e) => e.stopPropagation()}>
                {/* 헤더 영역 - 고정 */}
                <div className="flex-shrink-0 p-4 sm:p-6 pb-2 sm:pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {isSpecialSchedule ? '상세 정보' : 
                                 isSimSchedule ? `${flight.flightNumber} 상세 정보` : 
                                 `${flight.flightNumber}편 상세 정보`}
                            </h2>
                            {onEditFlight && (
                                <button
                                    onClick={handleEditFlight}
                                    className="ml-3 p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                    title={isEditMode ? "저장" : "수정"}
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                            )}
                            {isEditMode && onDeleteFlight && (
                                <button
                                    onClick={handleDeleteConfirm}
                                    className="ml-2 p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="삭제"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            )}
                            {isEditMode && (
                                <button
                                    onClick={handleCancelEdit}
                                    className="ml-2 p-1 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded-full transition-colors"
                                    title="취소"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button onClick={onClose} className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 스크롤 가능한 본문 영역 */}
                <div 
                    className={`flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent`}
                >
                    <div className={`${isSpecialSchedule ? '' : 'mb-6'}`}>
                        <div className="space-y-2 text-base">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">DATE</span>
                                    <span className="text-gray-800 dark:text-gray-200">
                                    {(() => {
                                        if (timeDisplayMode === 'utc') {
                                            // 요구사항: Z(UTC) 모드에서는 DATE도 UTC 날짜로 표시
                                            try {
                                                if (flight.departureDateTimeUtc) {
                                                    const depUtc = new Date(flight.departureDateTimeUtc);
                                                    return formatInTimeZone(depUtc, 'UTC', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (UTC)';
                                                }
                                                const dateUtc = new Date(`${flight.date}T00:00:00Z`);
                                                return formatInTimeZone(dateUtc, 'UTC', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (UTC)';
                                            } catch {
                                                const dateUtc = new Date(`${flight.date}T00:00:00Z`);
                                                return formatInTimeZone(dateUtc, 'UTC', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (UTC)';
                                            }
                                        } else if (timeDisplayMode === 'kst') {
                                            // KST 모드에서는 한국시간으로 표시
                                            try {
                                                if (flight.departureDateTimeUtc) {
                                                    const depUtc = new Date(flight.departureDateTimeUtc);
                                                    return formatInTimeZone(depUtc, 'Asia/Seoul', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (KST)';
                                                }
                                                const dateKst = new Date(`${flight.date}T00:00:00+09:00`);
                                                return formatInTimeZone(dateKst, 'Asia/Seoul', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (KST)';
                                            } catch {
                                                const dateKst = new Date(`${flight.date}T00:00:00+09:00`);
                                                return formatInTimeZone(dateKst, 'Asia/Seoul', 'yyyy년 M월 d일 EEEE', { locale: ko }) + ' (KST)';
                                            }
                                        } else {
                                            // 로컬 시간으로 표시 (기본)
                                            if (flightType === 'next') {
                                                try {
                                                    // 출발 도시의 로컬 날짜 계산 (다음 비행인 경우에만)
                                                    const departureAirport = flight.route?.split('/')[0];
                                                    if (departureAirport && flight.departureDateTimeUtc) {
                                                        const cityInfo = getCityInfo(departureAirport);
                                                        if (cityInfo) {
                                                            // UTC 출발 시간을 출발지 현지 시간으로 변환
                                                            const departureUtc = new Date(flight.departureDateTimeUtc);
                                                            const departureLocal = fromZonedTime(departureUtc, cityInfo.timezone);
                                                            
                                                            // 출발지 현지 날짜 반환
                                                            return departureLocal.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.error('출발지 날짜 계산 오류:', error);
                                                }
                                            }
                                            // 기본 날짜 또는 계산 실패 시 원래 날짜 반환
                                            return new Date(flight.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
                                        }
                                    })()}
                                </span>
                                </div>
                                
                                {/* L/Z/K 버튼 */}
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => setTimeDisplayMode('local')}
                                        className={`px-2 py-1 text-xs font-medium rounded ${
                                            timeDisplayMode === 'local' 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        L
                                    </button>
                                    <button
                                        onClick={() => setTimeDisplayMode('utc')}
                                        className={`px-2 py-1 text-xs font-medium rounded ${
                                            timeDisplayMode === 'utc' 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        Z
                                    </button>
                                    <button
                                        onClick={() => setTimeDisplayMode('kst')}
                                        className={`px-2 py-1 text-xs font-medium rounded ${
                                            timeDisplayMode === 'kst' 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        K
                                    </button>
                                </div>
                            </div>
                            
                            {isStandby && !flight.flightNumber.includes('RESERVE') && (
                                <div className="flex items-center">
                                    <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">시간</span>
                                    <span className="text-gray-800 dark:text-gray-200">
                                        {/* A STBY/B STBY는 OZ 스케줄이면 하드코딩된 시간, 다른 스케줄은 실제 시간 사용 */}
                                        {flight.flightNumber === 'A STBY' || flight.flightNumber === 'B STBY' ? (
                                            currentUser?.company === 'OZ' ? (
                                                flight.flightNumber === 'A STBY' ? '04:00 → 16:00' :
                                                flight.flightNumber === 'B STBY' ? '09:00 → 21:00' : ''
                                            ) : (
                                                flight.departureDateTimeUtc && flight.arrivalDateTimeUtc ? (
                                                    (() => {
                                                        const depUtc = new Date(flight.departureDateTimeUtc);
                                                        const arrUtc = new Date(flight.arrivalDateTimeUtc);
                                                        
                                                        if (timeDisplayMode === 'utc') {
                                                            const depUtcTime = formatInTimeZone(depUtc, 'UTC', 'HH:mm');
                                                            const arrUtcTime = formatInTimeZone(arrUtc, 'UTC', 'HH:mm');
                                                            return `${depUtcTime} → ${arrUtcTime} (UTC)`;
                                                        } else if (timeDisplayMode === 'kst') {
                                                            const depKstTime = formatInTimeZone(depUtc, 'Asia/Seoul', 'HH:mm');
                                                            const arrKstTime = formatInTimeZone(arrUtc, 'Asia/Seoul', 'HH:mm');
                                                            return `${depKstTime} → ${arrKstTime} (KST)`;
                                                        } else {
                                                            const depLocalTime = formatInTimeZone(depUtc, 'Asia/Seoul', 'HH:mm');
                                                            const arrLocalTime = formatInTimeZone(arrUtc, 'Asia/Seoul', 'HH:mm');
                                                            return `${depLocalTime} → ${arrLocalTime}`;
                                                        }
                                                    })()
                                                ) : (
                                                    flight.flightNumber === 'A STBY' ? '04:00 → 16:00' :
                                                    flight.flightNumber === 'B STBY' ? '09:00 → 21:00' : ''
                                                )
                                            )
                                        ) : (
                                            flight.departureDateTimeUtc && flight.arrivalDateTimeUtc ? (
                                                (() => {
                                                    const depUtc = new Date(flight.departureDateTimeUtc);
                                                    const arrUtc = new Date(flight.arrivalDateTimeUtc);
                                                    
                                                    if (timeDisplayMode === 'utc') {
                                                        const depUtcTime = formatInTimeZone(depUtc, 'UTC', 'HH:mm');
                                                        const arrUtcTime = formatInTimeZone(arrUtc, 'UTC', 'HH:mm');
                                                        return `${depUtcTime} → ${arrUtcTime} (UTC)`;
                                                    } else if (timeDisplayMode === 'kst') {
                                                        const depKstTime = formatInTimeZone(depUtc, 'Asia/Seoul', 'HH:mm');
                                                        const arrKstTime = formatInTimeZone(arrUtc, 'Asia/Seoul', 'HH:mm');
                                                        return `${depKstTime} → ${arrKstTime} (KST)`;
                                                    } else {
                                                        // 출발시간은 출발지 현지시간으로 표시
                                                        const [depAirport] = flight.route?.split('/') || [];
                                                        const depTz = depAirport ? getCityInfo(depAirport)?.timezone : 'Asia/Seoul';
                                                        const depLocalTime = formatInTimeZone(depUtc, depTz || 'Asia/Seoul', 'HH:mm');
                                                        
                                                        // 도착시간은 도착지 현지시간으로 표시
                                                        const [, arrAirport] = flight.route?.split('/') || [];
                                                        const arrTz = arrAirport ? getCityInfo(arrAirport)?.timezone : 'Asia/Seoul';
                                                        const arrLocalTime = formatInTimeZone(arrUtc, arrTz || 'Asia/Seoul', 'HH:mm');
                                                        
                                                        return `${depLocalTime} → ${arrLocalTime}`;
                                                    }
                                                })()
                                            ) : (
                                                standbyTime
                                            )
                                        )}
                                    </span>
                                </div>
                            )}

                            {(!isSpecialSchedule || is7CSpecialSchedule || is7CVacationSchedule) && (
                                <>
                                    <div className="flex items-center">
                                        <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">ROUTE</span>
                                        <div className="flex items-center space-x-0.5">
                                            {isActualFlight(flight) && flight.route ? (
                                                flight.route.split('/').map((airport, index) => (
                                                    <React.Fragment key={index}>
                                                        <button
                                                            onClick={() => onAirportClick(airport)}
                                                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm font-medium"
                                                            title={`${airport} 도시 정보 보기`}
                                                        >
                                                            {airport}
                                                        </button>
                                                        {index === 0 && (
                                                            <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            ) : (
                                                <span className="text-gray-500 dark:text-gray-400 italic">
                                                    {isActualFlight(flight) ? '경로 정보 없음' : '특별 스케줄'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {showUpTime && !flight.flightNumber.includes('RESERVE') && (
                                        <div className="flex items-center">
                                            <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">SHOW UP</span>
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {flight.showUpDateTimeUtc ? (
                                                    (() => {
                                                        const showUpUtc = new Date(flight.showUpDateTimeUtc);
                                                        if (timeDisplayMode === 'utc') {
                                                            return formatInTimeZone(showUpUtc, 'UTC', 'HH:mm') + ' (UTC)';
                                                        } else if (timeDisplayMode === 'kst') {
                                                            return formatInTimeZone(showUpUtc, 'Asia/Seoul', 'HH:mm') + ' (KST)';
                                                        } else {
                                                            // 로컬 시간 (기본) - 한국 공항 출발편이므로 한국 시간으로 표시
                                                            return formatInTimeZone(showUpUtc, 'Asia/Seoul', 'HH:mm');
                                                        }
                                                    })()
                                                ) : showUpTime}
                                            </span>
                                        </div>
                                    )}
                                    {!flight.flightNumber.includes('RESERVE') && (
                                        <div className="flex items-center">
                                            <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">출도착 시간</span>
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {flight.departureDateTimeUtc && flight.arrivalDateTimeUtc ? (
                                                    (() => {
                                                        const depUtc = new Date(flight.departureDateTimeUtc);
                                                        const arrUtc = new Date(flight.arrivalDateTimeUtc);
                                                        
                                                        if (timeDisplayMode === 'utc') {
                                                            // UTC 시간으로 표시 (데이터베이스 기준)
                                                            const depUtcTime = formatInTimeZone(depUtc, 'UTC', 'HH:mm');
                                                            const arrUtcTime = formatInTimeZone(arrUtc, 'UTC', 'HH:mm');
                                                            return `${depUtcTime} → ${arrUtcTime} (UTC)`;
                                                        } else if (timeDisplayMode === 'kst') {
                                                            // KST 시간으로 표시 (UTC 데이터를 한국시간으로 변환)
                                                            const depKstTime = formatInTimeZone(depUtc, 'Asia/Seoul', 'HH:mm');
                                                            const arrKstTime = formatInTimeZone(arrUtc, 'Asia/Seoul', 'HH:mm');
                                                            return `${depKstTime} → ${arrKstTime} (KST)`;
                                                        } else {
                                                            // 로컬 시간으로 표시 (기본) - UTC 데이터를 각 공항의 현지시간으로 변환
                                                            // 출발시간은 출발지 현지시간으로 표시
                                                            const [depAirport] = flight.route?.split('/') || [];
                                                            const depTz = depAirport ? getCityInfo(depAirport)?.timezone : 'Asia/Seoul';
                                                            const depLocalTime = formatInTimeZone(depUtc, depTz || 'Asia/Seoul', 'HH:mm');
                                                            
                                                            // 도착시간은 도착지 현지시간으로 표시
                                                            const [, arrAirport] = flight.route?.split('/') || [];
                                                            const arrTz = arrAirport ? getCityInfo(arrAirport)?.timezone : 'Asia/Seoul';
                                                            const arrLocalTime = formatInTimeZone(arrUtc, arrTz || 'Asia/Seoul', 'HH:mm');
                                                            
                                                            return `${depLocalTime} → ${arrLocalTime}`;
                                                        }
                                                    })()
                                                ) : (
                                                    '시간 정보 없음'
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center">
                                        <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">REG NO</span>
                                        {isEditMode ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingRegNo}
                                                    onChange={(e) => setEditingRegNo(e.target.value.toUpperCase())}
                                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-sm"
                                                    placeholder="예: HL8521"
                                                    style={{ textTransform: 'uppercase' }}
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            // regNo만 즉시 저장 - 빈 문자열이면 null로 처리
                                                            const updatedFlight = {
                                                                ...flight,
                                                                regNo: editingRegNo.trim() || null,
                                                                lastModified: new Date().toISOString(),
                                                                version: (flight.version || 0) + 1
                                                            };
                                                            if (onEditFlight) {
                                                                onEditFlight(updatedFlight);
                                                            }
                                                        }}
                                                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors text-xs"
                                                        title="REG NO 저장"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // regNo 삭제 - Firebase에서 undefined는 허용하지 않으므로 null 사용
                                                            const updatedFlight = {
                                                                ...flight,
                                                                regNo: null,
                                                                lastModified: new Date().toISOString(),
                                                                version: (flight.version || 0) + 1
                                                            };
                                                            if (onEditFlight) {
                                                                onEditFlight(updatedFlight);
                                                            }
                                                            setEditingRegNo('');
                                                        }}
                                                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-xs"
                                                        title="REG NO 삭제"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {flight.regNo || '정보 없음'}
                                            </span>
                                        )}
                                    </div>
                                    {/* KE 스케줄에만 A/C TYPE 표시 */}
                                    {flight.acType && (
                                        <div className="flex items-center">
                                            <span className="w-24 font-semibold text-gray-500 dark:text-gray-400">A/C TYPE</span>
                                            <span className="text-gray-800 dark:text-gray-200">{flight.acType}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {(!isSpecialSchedule || is7CSpecialSchedule || is7CVacationSchedule) && (
                        <>
                            <div className="border-t dark:border-gray-700 pt-4">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                    FLIGHT CREW LIST ({crewList.length})
                                </h3>
                                <div className="overflow-x-auto mb-4">
                                    <table className="w-full text-sm text-center">
                                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-1 py-1 w-20 sm:w-24">EMPL</th>
                                                <th className="px-2 py-1 w-28 sm:w-32">NAME</th>
                                                <th className="px-1 py-1 w-16 sm:w-20 text-center">RANK</th>
                                                <th className="px-1 py-1 w-20 sm:w-24 text-center">POSN TYPE</th>
                                                <th className="px-1 py-1 w-16 sm:w-20 text-center">POSN</th>
                                                {isEditMode && <th className="px-1 py-1 w-20 text-center">ACTIONS</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* KE 스케줄이고 사용자 정보가 있으면 우선적으로 표시 */}
                                            {flight.flightNumber && flight.flightNumber.includes('KE') && (currentUser?.userName || currentUser?.displayName) && currentUser?.empl ? (
                                                <tr className="border-b dark:border-gray-700 bg-green-100 dark:bg-green-900/50">
                                                    <td className="px-1 py-1 font-medium text-gray-900 dark:text-gray-200 w-20 sm:w-24">{currentUser.empl}</td>
                                                    <td className="px-2 py-1 text-gray-900 dark:text-gray-200 w-28 sm:w-32">
                                                        <div className="flex items-center justify-center">
                                                            <span className="whitespace-nowrap">{currentUser.userName || currentUser.displayName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center"></td>
                                                    <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-20 sm:w-24 text-center"></td>
                                                    <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center"></td>
                                                    {isEditMode && <td className="px-1 py-1 w-20 text-center"></td>}
                                                </tr>
                                            ) : crewList?.length > 0 ? (
                                                crewList.map((member, index) => {
                                                    const isCurrentUser = member.name === (currentUser?.userName || currentUser?.displayName);
                                                    const isPaxCrew = member.posnType?.toLowerCase() === 'pax';
                                                    const isEditing = editingCrew === member.empl;
                                                    
                                                    // 고유한 key 생성 (empl이 비어있거나 중복될 수 있으므로 index 추가)
                                                    const uniqueKey = member.empl ? `${member.empl}-${index}` : `crew-${index}`;
                                                    
                                                    return (
                                                        <tr key={uniqueKey} className={`border-b dark:border-gray-700 ${
                                                            isCurrentUser ? 'bg-green-100 dark:bg-green-900/50' : 
                                                            isPaxCrew ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                                                        }`}>
                                                            <td className="px-1 py-1 font-medium text-gray-900 dark:text-gray-200 w-20 sm:w-24">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={newCrewMember.empl}
                                                                        onChange={(e) => setNewCrewMember({...newCrewMember, empl: e.target.value.toUpperCase()})}
                                                                        style={{ textTransform: 'uppercase' }}
                                                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
                                                                    />
                                                                ) : (
                                                                    member.empl
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-1 text-gray-900 dark:text-gray-200 w-28 sm:w-32">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={newCrewMember.name}
                                                                        onChange={(e) => setNewCrewMember({...newCrewMember, name: e.target.value.toUpperCase()})}
                                                                        style={{ textTransform: 'uppercase' }}
                                                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <span 
                                                                            className={`whitespace-nowrap ${!isCurrentUser && !isEditMode ? 'cursor-pointer' : ''}`}
                                                                            onClick={() => !isCurrentUser && !isEditMode && onCrewClick(member.name, member.empl, 'flight')}
                                                                            title={!isCurrentUser && !isEditMode ? `${member.name}님과의 비행 기록 보기` : ''}
                                                                        >
                                                                            {member.name}
                                                                        </span>
                                                                        {onMemoClick && !isCurrentUser && !isEditMode && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onMemoClick(member.name);
                                                                                }}
                                                                                className="p-0.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                                                                title="메모 작성"
                                                                            >
                                                                                <MemoIcon className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={newCrewMember.rank}
                                                                        onChange={(e) => setNewCrewMember({...newCrewMember, rank: e.target.value})}
                                                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
                                                                    />
                                                                ) : (
                                                                    member.rank
                                                                )}
                                                            </td>
                                                            <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-20 sm:w-24 text-center">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={newCrewMember.posnType}
                                                                        onChange={(e) => setNewCrewMember({...newCrewMember, posnType: e.target.value})}
                                                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
                                                                    />
                                                                ) : (
                                                                    member.posnType
                                                                )}
                                                            </td>
                                                            <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={newCrewMember.posn}
                                                                        onChange={(e) => setNewCrewMember({...newCrewMember, posn: e.target.value})}
                                                                        className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
                                                                    />
                                                                ) : (
                                                                    member.posn
                                                                )}
                                                            </td>
                                                            {isEditMode && (
                                                                <td className="px-1 py-1 w-20 text-center">
                                                                    {isEditing ? (
                                                                        <div className="flex gap-1 justify-center">
                                                                            <button
                                                                                onClick={handleSaveCrewEdit}
                                                                                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                                                                                title="저장"
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                            <button
                                                                                onClick={handleCancelCrewEdit}
                                                                                className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                                                                                title="취소"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex gap-1 justify-center">
                                                                            <button
                                                                                onClick={() => handleEditCrew(member.empl)}
                                                                                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                                                                                title="수정"
                                                                            >
                                                                                ✏️
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteCrew(member.empl)}
                                                                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                                                                title="삭제"
                                                                            >
                                                                                🗑️
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={isEditMode ? 6 : 5} className="px-2 py-1 text-center text-gray-500 dark:text-gray-400">
                                                        승무원 정보가 없습니다.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* 새 승무원 추가 폼 (수정 모드일 때만 표시) */}
                                {isEditMode && (
                                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">새 승무원 추가</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-1 lg:gap-2 text-xs">
                                            <input
                                                type="text"
                                                placeholder="EMPL"
                                                value={newCrewMember.empl}
                                                onChange={(e) => setNewCrewMember({...newCrewMember, empl: e.target.value.toUpperCase()})}
                                                style={{ textTransform: 'uppercase' }}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="NAME"
                                                value={newCrewMember.name}
                                                onChange={(e) => setNewCrewMember({...newCrewMember, name: e.target.value.toUpperCase()})}
                                                style={{ textTransform: 'uppercase' }}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="RANK"
                                                value={newCrewMember.rank}
                                                onChange={(e) => setNewCrewMember({...newCrewMember, rank: e.target.value.toUpperCase()})}
                                                style={{ textTransform: 'uppercase' }}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="POSN TYPE"
                                                value={newCrewMember.posnType}
                                                onChange={(e) => setNewCrewMember({...newCrewMember, posnType: e.target.value.toUpperCase()})}
                                                style={{ textTransform: 'uppercase' }}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="POSN"
                                                value={newCrewMember.posn}
                                                onChange={(e) => setNewCrewMember({...newCrewMember, posn: e.target.value.toUpperCase()})}
                                                style={{ textTransform: 'uppercase' }}
                                                className="col-span-2 sm:col-span-1 lg:col-span-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                            />
                                            <button
                                                onClick={handleAddCrewMember}
                                                className="col-span-2 sm:col-span-1 lg:col-span-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors text-xs whitespace-nowrap"
                                                title="추가"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* CABIN CREW LIST 섹션 추가 */}
                            <div className="border-t dark:border-gray-700 pt-4 mt-4">
                                <div 
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setIsCabinCrewExpanded(!isCabinCrewExpanded)}
                                >
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                        CABIN CREW LIST ({cabinCrewList.length})
                                    </h3>
                                    <button className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                                        <svg 
                                            className={`w-5 h-5 transition-transform duration-200 ${isCabinCrewExpanded ? 'rotate-180' : ''}`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {isCabinCrewExpanded && (
                                    <div className="mt-2">
                                        <div className="overflow-x-auto mb-4">
                                            <table className="w-full text-sm text-center">
                                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                                    <tr>
                                                        <th className="px-1 py-1 w-20 sm:w-24">EMPL</th>
                                                        <th className="px-2 py-1 w-28 sm:w-32">NAME</th>
                                                        <th className="px-1 py-1 w-16 sm:w-20 text-center">RANK</th>
                                                        <th className="px-1 py-1 w-16 sm:w-20 text-center">GISU</th>
                                                        {isEditMode && <th className="px-1 py-1 w-20 text-center">ACTIONS</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cabinCrewList?.length > 0 ? (
                                                        cabinCrewList.map((member, index) => {
                                                            // 고유한 key 생성 (empl이 비어있거나 중복될 수 있으므로 index 추가)
                                                            const uniqueKey = member.empl ? `cabin-${member.empl}-${index}` : `cabin-crew-${index}`;
                                                            
                                                            return (
                                                            <tr key={uniqueKey} className="border-b dark:border-gray-700">
                                                                <td className="px-1 py-1 font-medium text-gray-900 dark:text-gray-200 w-20 sm:w-24">
                                                                    {member.empl}
                                                                </td>
                                                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200 w-28 sm:w-32">
                                                                    <span 
                                                                        className="whitespace-nowrap cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                                        onClick={() => onCrewClick && onCrewClick(member.name, member.empl, 'cabin')}
                                                                        title="클릭하여 함께 비행한 기록 보기"
                                                                    >
                                                                        {member.name}
                                                                    </span>
                                                                </td>
                                                                <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center">
                                                                    {member.rank}
                                                                </td>
                                                                <td className="px-1 py-1 text-gray-900 dark:text-gray-200 w-16 sm:w-20 text-center">
                                                                    {member.gisu || '-'}
                                                                </td>
                                                                {isEditMode && (
                                                                    <td className="px-1 py-1 w-20 text-center">
                                                                        <button
                                                                            onClick={() => handleDeleteCabinCrew(member.empl)}
                                                                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                                                            title="삭제"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={isEditMode ? 5 : 4} className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">
                                                                객실 승무원 정보가 없습니다.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        {/* 새 객실 승무원 추가 폼 (수정 모드일 때만 표시) */}
                                        {isEditMode && (
                                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">새 객실 승무원 추가</h4>
                                                <div className="flex gap-2 items-end w-full flex-wrap sm:flex-nowrap">
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="EMPL"
                                                            value={newCabinCrewMember.empl}
                                                            onChange={(e) => setNewCabinCrewMember({...newCabinCrewMember, empl: e.target.value.toUpperCase()})}
                                                            style={{ textTransform: 'uppercase' }}
                                                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="NAME"
                                                            value={newCabinCrewMember.name}
                                                            onChange={(e) => setNewCabinCrewMember({...newCabinCrewMember, name: e.target.value.toUpperCase()})}
                                                            style={{ textTransform: 'uppercase' }}
                                                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="RANK"
                                                            value={newCabinCrewMember.rank}
                                                            onChange={(e) => setNewCabinCrewMember({...newCabinCrewMember, rank: e.target.value.toUpperCase()})}
                                                            style={{ textTransform: 'uppercase' }}
                                                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="GISU"
                                                            value={newCabinCrewMember.gisu}
                                                            onChange={(e) => setNewCabinCrewMember({...newCabinCrewMember, gisu: e.target.value.toUpperCase()})}
                                                            style={{ textTransform: 'uppercase' }}
                                                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 text-xs"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleAddCabinCrewMember}
                                                        className="px-4 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors text-xs whitespace-nowrap min-w-[60px]"
                                                        title="추가"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* 지난 스케줄일 경우에만 이착륙 선택 버튼 표시 (비행 스케줄인 경우에만) */}
                            {(flightType === 'last' || isPastByTime) && 
                             isActualFlight(flight) && (
                                <div className="border-t dark:border-gray-700 pt-4">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">이착륙 선택</h3>
                                    <div className="flex space-x-2">
                                        {/* 이륙 버튼: flight.status.departed 값에 따라 동적으로 표시 */}
                                        <button
                                            onClick={() => {
                                                if (onStatusChange) {
                                                    onStatusChange(flight.id, { departed: !flight.status?.departed });
                                                } else {
                                                    handleUpdateStatus('departed');
                                                }
                                            }}
                                            disabled={isUpdating}
                                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                                flight.status?.departed 
                                                    ? 'bg-blue-500 text-white shadow-lg' 
                                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                                        >
                                            {isUpdating ? '처리중...' : '이륙'}
                                        </button>

                                        {/* 착륙 버튼: 독립적으로 작동하도록 수정 */}
                                        <button
                                            onClick={() => {
                                                if (onStatusChange) {
                                                    onStatusChange(flight.id, { landed: !flight.status?.landed });
                                                } else {
                                                    handleUpdateStatus('landed');
                                                }
                                            }}
                                            disabled={isUpdating}
                                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                                flight.status?.landed 
                                                    ? 'bg-green-500 text-white shadow-lg' 
                                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                                        >
                                            {isUpdating ? '처리중...' : '착륙'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
        
        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center overflow-y-auto z-[80] p-4 pt-safe">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full" style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px)' }}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        ⚠️ 스케줄 삭제 확인
                    </h3>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                            {deleteConfirmCount === 0 ? '정말로 삭제하시겠습니까?' : '⚠️ 최종 확인: 정말로 삭제하시겠습니까?'}
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-sm">
                            {flight.flightNumber}편 ({flight.date}) 스케줄과 모든 관련 데이터가<br/>
                            <strong>영구적으로 삭제</strong>됩니다.
                        </p>
                        <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                            이 작업은 되돌릴 수 없습니다.
                        </p>
                    </div>
                    <div className="flex space-x-3 justify-end">
                        <button
                            onClick={handleDeleteCancel}
                            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 rounded-md transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleDeleteConfirmClick}
                            className={`px-4 py-2 text-white rounded-md transition-colors ${
                                deleteConfirmCount === 0 
                                    ? 'bg-red-500 hover:bg-red-600' 
                                    : 'bg-red-600 hover:bg-red-700 animate-pulse'
                            }`}
                        >
                            {deleteConfirmCount === 0 ? '삭제 확인' : '정말 삭제'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

export default FlightDetailModal;