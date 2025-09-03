
import React from 'react';
import { CurrencyInfo } from '../types';

interface CurrencyCardProps {
    title: string;
    currencyInfo: CurrencyInfo;
    onClick: () => void;
}

const CurrencyCard: React.FC<CurrencyCardProps> = ({ title, currencyInfo, onClick }) => {
    // currencyInfo가 undefined인 경우 기본값 제공
    if (!currencyInfo) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer transform hover:scale-105 transition-transform duration-300 flex flex-col justify-center h-full min-h-[120px] sm:min-h-[140px]">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
                </div>
                <div className="mt-2 text-center flex-1 flex flex-col justify-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        0 <span className="text-base font-medium text-gray-500 dark:text-gray-400">/ 3회</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">(최근 90일)</p>
                </div>
                <div className="mt-3 py-2 px-3 rounded-lg text-center bg-gray-100 dark:bg-gray-700">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">데이터 없음</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">자격 정보를 불러올 수 없습니다</p>
                </div>
            </div>
        );
    }

    const getExpiryStyle = (days: number | null, isCurrent: boolean) => {
        if (!isCurrent) return { text: 'text-gray-200', bg: 'bg-gray-700 dark:bg-gray-800', label: '횟수 부족' };
        if (days === null || days < 0) return { text: 'text-gray-200', bg: 'bg-gray-700 dark:bg-gray-800', label: '만료됨' };
        
        const label = `D-${days}`;
        if (days <= 7) return { text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', label };
        if (days <= 30) return { text: 'text-orange-800 dark:text-orange-200', bg: 'bg-orange-100 dark:bg-orange-800', label };
        return { text: 'text-lime-800 dark:text-lime-200', bg: 'bg-lime-200 dark:bg-lime-700', label };
    };
    
    const style = getExpiryStyle(currencyInfo.daysUntilExpiry, currencyInfo.isCurrent);

    return (
        <div onClick={onClick} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer transform hover:scale-105 transition-transform duration-300 flex flex-col justify-center h-full min-h-[120px] sm:min-h-[140px]">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
            </div>
            <div className="mt-2 text-center flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {currencyInfo.count} <span className="text-base font-medium text-gray-500 dark:text-gray-400">/ 3회</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">(최근 90일)</p>
            </div>
            <div className={`mt-3 py-2 px-3 rounded-lg text-center ${style.bg}`}>
                <p className={`text-sm font-bold ${style.text}`}>{style.label}</p>
                <p className={`text-xs ${style.text}`}>
                    {currencyInfo.expiryDate ? `${currencyInfo.expiryDate} 만료 예정` : '자격 미충족'}
                </p>
            </div>
        </div>
    );
};

export default CurrencyCard;
