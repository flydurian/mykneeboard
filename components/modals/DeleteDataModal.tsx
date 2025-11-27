import React, { useState, useEffect } from 'react';
import { XIcon } from '../icons';

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (year: number, month: number) => Promise<void>;
  flights: any[];
  isDeleting: boolean;
}

const DeleteDataModal: React.FC<DeleteDataModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  flights,
  isDeleting
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [showConfirm, setShowConfirm] = useState(false);

  // 사용 가능한 년월 목록 생성
  const availableMonths = React.useMemo(() => {
    const monthSet = new Set<string>();
    flights.forEach(flight => {
      if (flight.date) {
        const date = new Date(flight.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthSet.add(`${year}-${month}`);
      }
    });

    return Array.from(monthSet)
      .map(dateStr => {
        const [year, month] = dateStr.split('-').map(Number);
        return { year, month };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [flights]);

  // 년도 목록 생성
  const availableYears = React.useMemo(() => {
    const yearSet = new Set<number>();
    availableMonths.forEach(({ year }) => yearSet.add(year));
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [availableMonths]);

  // 선택된 년도에 해당하는 월 목록
  const availableMonthsForYear = React.useMemo(() => {
    return availableMonths
      .filter(({ year }) => year === selectedYear)
      .map(({ month }) => month)
      .sort((a, b) => b - a);
  }, [availableMonths, selectedYear]);

  // 선택된 년월의 데이터 개수
  const selectedDataCount = React.useMemo(() => {
    return flights.filter(flight => {
      if (!flight.date) return false;
      const date = new Date(flight.date);
      return date.getFullYear() === selectedYear && date.getMonth() + 1 === selectedMonth;
    }).length;
  }, [flights, selectedYear, selectedMonth]);

  // 년도 변경 시 월 초기화
  useEffect(() => {
    if (availableMonthsForYear.length > 0) {
      setSelectedMonth(availableMonthsForYear[0]);
    }
  }, [selectedYear, availableMonthsForYear]);

  const handleDelete = async () => {
    await onDelete(selectedYear, selectedMonth);
    setShowConfirm(false);
    onClose();
  };

  const handleClose = () => {
    setShowConfirm(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-safe"
      onClick={handleBackdropClick}
    >
      <div className="glass-panel rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">
            데이터 삭제
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
            disabled={isDeleting}
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {!showConfirm ? (
          <>
            {/* Content */}
            <div className="p-6">
              <p className="text-slate-400 mb-6">
                삭제할 데이터의 년월을 선택하세요.
              </p>

              {/* Year Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  년도
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="glass-input w-full p-3 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isDeleting}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  월
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="glass-input w-full p-3 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isDeleting}
                >
                  {availableMonthsForYear.map(month => (
                    <option key={month} value={month}>
                      {month}월
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Count */}
              <div className="bg-black/20 rounded-lg p-4 mb-6 border border-white/10">
                <p className="text-sm text-slate-400">
                  선택된 기간: <span className="font-semibold text-white">{selectedYear}년 {selectedMonth}월</span>
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  삭제될 데이터: <span className="font-semibold text-red-400">{selectedDataCount}개</span>
                </p>
              </div>

              {selectedDataCount === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-200">
                    선택된 기간에 삭제할 데이터가 없습니다.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={selectedDataCount === 0 || isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                삭제하기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20 mb-4">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  정말 삭제하시겠습니까?
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  <span className="font-semibold text-white">{selectedYear}년 {selectedMonth}월</span>의 모든 데이터가 삭제됩니다.
                </p>
                <p className="text-sm text-red-400 font-medium">
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteDataModal;
