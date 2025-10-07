import React, { useState, useEffect } from 'react';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    min?: string;
    className?: string;
    placeholder?: string;
    triggerRef?: React.RefObject<HTMLElement>;
    theme?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    onChange,
    min,
    className = '',
    placeholder = '날짜 선택',
    triggerRef,
    theme = 'system'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);

    // 테마에 따른 다크 모드 계산
    const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        if (value) {
            setSelectedDate(new Date(value));
        }
    }, [value]);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMonthPicker || showYearPicker) {
                const target = event.target as Element;
                if (!target.closest('.date-picker-dropdown')) {
                    setShowMonthPicker(false);
                    setShowYearPicker(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMonthPicker, showYearPicker]);

    const today = new Date();
    // 한국 시간대 기준으로 minDate 설정
    const minDate = min ? new Date(min + 'T00:00:00') : new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const getLastDayOfPrevMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    };

    const formatDate = (date: Date) => {
        // 한국 시간대로 변환하여 날짜 포맷팅
        const koreanDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const year = koreanDate.getFullYear();
        const month = String(koreanDate.getMonth() + 1).padStart(2, '0');
        const day = String(koreanDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateSelect = (date: Date) => {
        // 한국 시간대 기준으로 날짜 비교
        const koreanDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const koreanMinDate = new Date(minDate.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        if (koreanDate < koreanMinDate) return;
        setSelectedDate(date);
        onChange(formatDate(date));
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleToday = () => {
        // 한국 시간대 기준으로 오늘 날짜 생성
        const koreanToday = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const todayDate = new Date(koreanToday.getFullYear(), koreanToday.getMonth(), koreanToday.getDate());
        
        if (todayDate >= minDate) {
            handleDateSelect(todayDate);
        }
    };

    const handleClear = () => {
        setSelectedDate(null);
        onChange('');
        setIsOpen(false);
    };

    const handleMonthSelect = (month: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), month, 1));
        setShowMonthPicker(false);
    };

    const handleYearSelect = (year: number) => {
        setCurrentDate(new Date(year, currentDate.getMonth(), 1));
        setShowYearPicker(false);
    };

    const generateYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let year = currentYear; year <= currentYear + 20; year++) {
            years.push(year);
        }
        return years;
    };

    const getCalendarPosition = () => {
        if (!triggerRef?.current) {
            return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
        }
        
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const calendarWidth = 360;
        
        // 카드 위쪽에 표시 (카드가 보이도록)
        const topPosition = Math.max(20, rect.top - 420); // 달력 높이 + 여백
        
        // 카드의 가운데 정렬
        const cardCenterX = rect.left + (rect.width / 2);
        const leftPosition = Math.max(20, Math.min(cardCenterX - (calendarWidth / 2), viewportWidth - calendarWidth - 20));
        
        return `fixed top-${topPosition}px left-${leftPosition}px`;
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const lastDayOfPrevMonth = getLastDayOfPrevMonth(currentDate);
        
        const days = [];
        
        // 이전 달의 날짜들
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = lastDayOfPrevMonth - i;
            // UTC 기준으로 날짜 생성하여 시간대 문제 방지
            const date = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth() - 1, day));
            days.push(
                <button
                    key={`prev-${day}`}
                    className={`w-8 h-8 text-sm ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                    disabled
                >
                    {day}
                </button>
            );
        }
        
        // 현재 달의 날짜들
        for (let day = 1; day <= daysInMonth; day++) {
            // UTC 기준으로 날짜 생성하여 시간대 문제 방지
            const date = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), day));
            const isToday = formatDate(date) === formatDate(today);
            const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate);
            // 한국 시간대 기준으로 날짜 비교
            const koreanDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
            const koreanMinDate = new Date(minDate.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
            const isDisabled = koreanDate < koreanMinDate;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            days.push(
                <button
                    key={day}
                    onClick={() => handleDateSelect(date)}
                    disabled={isDisabled}
                    className={`w-8 h-8 text-sm rounded-full transition-colors ${
                        isSelected
                            ? 'bg-blue-600 text-white'
                            : isToday
                            ? isDarkMode 
                                ? 'bg-blue-900 text-blue-400 font-semibold'
                                : 'bg-blue-100 text-blue-600 font-semibold'
                            : isDisabled
                            ? isDarkMode
                                ? 'text-gray-700 cursor-not-allowed'
                                : 'text-gray-300 cursor-not-allowed'
                            : isWeekend
                            ? isDarkMode
                                ? 'text-red-400 hover:bg-red-900/20'
                                : 'text-red-500 hover:bg-red-50'
                            : isDarkMode
                                ? 'text-gray-300 hover:bg-gray-700'
                                : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    {day}
                </button>
            );
        }
        
        // 다음 달의 날짜들 (캘린더를 채우기 위해)
        const totalCells = 42; // 6주 * 7일
        const remainingCells = totalCells - days.length;
        for (let day = 1; day <= remainingCells; day++) {
            days.push(
                <button
                    key={`next-${day}`}
                    className={`w-8 h-8 text-sm ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                    disabled
                >
                    {day}
                </button>
            );
        }
        
        return days;
    };

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const months = [
        '1월', '2월', '3월', '4월', '5월', '6월',
        '7월', '8월', '9월', '10월', '11월', '12월'
    ];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm sm:text-base text-left ${className}`}
            >
                {selectedDate ? formatDate(selectedDate) : placeholder}
            </button>
            
            {isOpen && (
                <div className={`${getCalendarPosition()} ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} rounded-lg shadow-xl z-50 p-4 w-[360px] max-w-[90vw] relative`}>
                    {/* 닫기 버튼 */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    
                    {/* 헤더 */}
                    <div className="flex items-center justify-between mb-4 pr-8">
                        <div className="flex items-center gap-2 relative date-picker-dropdown">
                            <button
                                onClick={() => setShowYearPicker(!showYearPicker)}
                                className={`font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors ${isDarkMode ? 'text-white' : 'text-gray-800'}`}
                            >
                                {currentDate.getFullYear()}년
                            </button>
                            <button
                                onClick={() => setShowMonthPicker(!showMonthPicker)}
                                className={`font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors ${isDarkMode ? 'text-white' : 'text-gray-800'}`}
                            >
                                {months[currentDate.getMonth()]}
                            </button>
                            
                            {/* 년도 선택 드롭다운 */}
                            {showYearPicker && (
                                <div 
                                    className={`absolute top-10 left-0 z-10 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg shadow-lg p-2 max-h-40 overflow-y-auto`}
                                    style={{
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: isDarkMode ? '#6B7280 transparent' : '#9CA3AF transparent'
                                    }}
                                >
                                    {generateYearOptions().map((year) => (
                                        <button
                                            key={year}
                                            onClick={() => handleYearSelect(year)}
                                            className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                                year === currentDate.getFullYear() 
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                                                    : isDarkMode ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {year}년
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {/* 월 선택 드롭다운 */}
                            {showMonthPicker && (
                                <div 
                                    className={`absolute top-10 left-16 z-10 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg shadow-lg p-2 max-h-40 overflow-y-auto min-w-[80px]`}
                                    style={{
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: isDarkMode ? '#6B7280 transparent' : '#9CA3AF transparent'
                                    }}
                                >
                                    {months.map((month, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleMonthSelect(index)}
                                            className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap ${
                                                index === currentDate.getMonth() 
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                                                    : isDarkMode ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {month}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map((day) => (
                            <div
                                key={day}
                                className={`w-8 h-8 flex items-center justify-center text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                            >
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendar()}
                    </div>
                    
                    {/* 푸터 버튼들 */}
                    <div className="flex justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex gap-2">
                            <button
                                onClick={handleClear}
                                className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                            >
                                지우기
                            </button>
                            <button
                                onClick={handleToday}
                                className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                            >
                                오늘
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 오버레이 */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default CustomDatePicker;