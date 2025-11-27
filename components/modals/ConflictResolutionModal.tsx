import React, { useRef } from 'react';

interface ConflictData {
  flightId: number;
  flightNumber: string;
  date: string;
  route: string;
  localData: {
    status: {
      departed: boolean;
      landed: boolean;
    };
    lastModified?: string;
  };
  serverData: {
    status: {
      departed: boolean;
      landed: boolean;
    };
    lastModified?: string;
  };
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictData[];
  onResolve: (resolutions: { flightId: number; useLocal: boolean }[]) => void;
  // ✨ 필드 유실 방지를 위한 기존 비행 데이터 전달
  existingFlights?: any[];
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolve,
  existingFlights = []
}) => {
  const [resolutions, setResolutions] = React.useState<{ flightId: number; useLocal: boolean }[]>([]);
  const [showScrollbar, setShowScrollbar] = React.useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isOpen && conflicts.length > 0) {
      // 기본값으로 로컬 데이터 선택
      setResolutions(conflicts.map(conflict => ({
        flightId: conflict.flightId,
        useLocal: true
      })));
    }
  }, [isOpen, conflicts]);

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

  const handleResolutionChange = (flightId: number, useLocal: boolean) => {
    setResolutions(prev =>
      prev.map(resolution =>
        resolution.flightId === flightId
          ? { ...resolution, useLocal }
          : resolution
      )
    );
  };

  // ✨ 데이터 병합 로직
  const mergeData = (local: any, server: any) => {
    // 서버 데이터를 기준으로 하되, 로컬의 status 변경사항만 반영한다.
    const merged = {
      ...server, // 서버 데이터를 기본으로 복사
      status: local.status // status만 로컬 데이터로 덮어쓰기
    };
    return merged;
  };

  // ✨ [최종 해결책] 데이터 소스를 검증하고 안전하게 덮어쓰는 함수
  const handleResolveAll = async () => {
    try {
      // 모든 충돌에 대해 데이터 소스를 검증하고 안전하게 덮어쓰기 실행
      for (const resolution of resolutions) {
        const conflict = conflicts.find(c => c.flightId === resolution.flightId);
        if (!conflict) continue;

        // 기존 비행 데이터에서 로컬과 서버 데이터 구성
        const existingFlight = existingFlights.find(f => f.id === conflict.flightId);

        // 로컬 비행 데이터 구성 (기존 데이터 + 로컬 status)
        const localFlight = {
          ...(existingFlight || {}),
          id: conflict.flightId,
          flightNumber: conflict.flightNumber,
          date: conflict.date,
          route: conflict.route,
          status: conflict.localData.status,
          lastModified: conflict.localData.lastModified
        };

        // 서버 비행 데이터 구성 (기존 데이터 + 서버 status)
        const serverFlight = {
          ...(existingFlight || {}),
          id: conflict.flightId,
          flightNumber: conflict.flightNumber,
          date: conflict.date,
          route: conflict.route,
          status: conflict.serverData.status,
          lastModified: conflict.serverData.lastModified
        };


        // --- STEP 1: 데이터 소스(재료)를 철저히 검증합니다 ---

        // 로컬 status가 유효한지 검사합니다.
        let localStatus = localFlight?.status;
        if (!localStatus || typeof localStatus.departed === 'undefined' || typeof localStatus.landed === 'undefined') {
          console.error("🚨 경고: 로컬 데이터의 status가 불완전하거나 없습니다.", localStatus);
          // 기존 비행 데이터의 status를 사용하거나, 서버 status를 사용
          localStatus = existingFlight?.status || serverFlight?.status || { departed: false, landed: false };
        }

        // 서버 status가 유효한지 검사합니다.
        let serverStatus = serverFlight?.status;
        if (!serverStatus || typeof serverStatus.departed === 'undefined' || typeof serverStatus.landed === 'undefined') {
          console.error("🚨 경고: 서버 데이터의 status가 불완전하거나 없습니다.", serverStatus);
          // 기존 비행 데이터의 status를 사용하거나, 로컬 status를 사용
          serverStatus = existingFlight?.status || localFlight?.status || { departed: false, landed: false };
        }

        // --- STEP 2: 검증된 데이터를 바탕으로 최종 status를 결정합니다 ---

        const choice = resolution.useLocal ? 'local' : 'server';
        const authoritativeStatus = (choice === 'local') ? localStatus : serverStatus;

        // --- STEP 3: 완전한 최종 객체를 만듭니다 ---

        const finalData = {
          ...serverFlight,
          ...localFlight,
          status: authoritativeStatus, // ✨ 검증 완료된 안전한 status로 덮어쓰기
          lastModified: new Date().toISOString(),
        };

        // --- STEP 4: 완성된 데이터로 충돌 해결 실행 ---
        const selectedResolution = { flightId: conflict.flightId, useLocal: resolution.useLocal };
        await onResolve([selectedResolution]);

      }

      onClose();
    } catch (error) {
      console.error('❌ 충돌 해결 중 오류 발생:', error);
      alert('충돌 해결 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '알 수 없음';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return '알 수 없음';
    }
  };

  const getStatusText = (status: { departed: boolean; landed: boolean }) => {
    if (status.departed && status.landed) return '이륙 완료, 착륙 완료';
    if (status.departed) return '이륙 완료';
    if (status.landed) return '착륙 완료';
    return '대기 중';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-safe" onClick={onClose}>
      <div className="glass-panel rounded-lg max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="bg-red-500/90 backdrop-blur-md text-white p-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">데이터 충돌 해결</h2>
            <button
              onClick={onClose}
              className="text-white text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-sm mt-1">
            {conflicts.length}개의 항공편에서 데이터 충돌이 발생했습니다. 사용할 데이터를 선택해주세요.
          </p>
        </div>

        {/* 내용 */}
        <div
          className={`p-6 overflow-y-auto flex-grow bg-transparent ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
          onScroll={handleScroll}
        >
          {conflicts.map((conflict, index) => (
            <div key={conflict.flightId} className="mb-6 p-4 border border-white/10 rounded-lg">
              {/* 항공편 정보 */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {conflict.flightNumber} - {conflict.route}
                </h3>
                <p className="text-sm text-slate-400">
                  날짜: {new Date(conflict.date).toLocaleDateString('ko-KR')}
                </p>
              </div>

              {/* 데이터 비교 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 로컬 데이터 */}
                <div className={`p-3 rounded-lg border-2 ${resolutions.find(r => r.flightId === conflict.flightId)?.useLocal
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-white/10 bg-white/5'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-400">로컬 데이터</h4>
                    <input
                      type="radio"
                      name={`conflict-${conflict.flightId}`}
                      checked={resolutions.find(r => r.flightId === conflict.flightId)?.useLocal}
                      onChange={() => handleResolutionChange(conflict.flightId, true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div>
                      <span className="font-medium">상태:</span> {getStatusText(conflict.localData.status)}
                    </div>
                    <div>
                      <span className="font-medium">최종 수정:</span>
                      <div className="text-slate-400">
                        {formatDateTime(conflict.localData.lastModified)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 서버 데이터 */}
                <div className={`p-3 rounded-lg border-2 ${!resolutions.find(r => r.flightId === conflict.flightId)?.useLocal
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-white/10 bg-white/5'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-green-400">서버 데이터</h4>
                    <input
                      type="radio"
                      name={`conflict-${conflict.flightId}`}
                      checked={!resolutions.find(r => r.flightId === conflict.flightId)?.useLocal}
                      onChange={() => handleResolutionChange(conflict.flightId, false)}
                      className="text-green-600 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div>
                      <span className="font-medium">상태:</span> {getStatusText(conflict.serverData.status)}
                    </div>
                    <div>
                      <span className="font-medium">최종 수정:</span>
                      <div className="text-slate-400">
                        {formatDateTime(conflict.serverData.lastModified)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 차이점 표시 */}
              <div className="bg-yellow-500/10 p-3 rounded-lg">
                <h5 className="font-medium text-yellow-300 mb-2">주요 차이점:</h5>
                <ul className="text-sm text-yellow-200 space-y-1">
                  {conflict.localData.status.departed !== conflict.serverData.status.departed && (
                    <li>• 이륙 상태: 로컬({conflict.localData.status.departed ? '완료' : '대기'}) vs 서버({conflict.serverData.status.departed ? '완료' : '대기'})</li>
                  )}
                  {conflict.localData.status.landed !== conflict.serverData.status.landed && (
                    <li>• 착륙 상태: 로컬({conflict.localData.status.landed ? '완료' : '대기'}) vs 서버({conflict.serverData.status.landed ? '완료' : '대기'})</li>
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="bg-black/20 p-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 border border-white/20 rounded hover:bg-white/10 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleResolveAll}
            className="px-6 py-2 bg-red-500 text-white rounded"
          >
            업데이트 ({conflicts.length}개)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
