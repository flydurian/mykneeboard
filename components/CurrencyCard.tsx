
import React from 'react';
import { CurrencyInfo } from '../types';

interface CurrencyCardProps {
    title: string;
    currencyInfo: CurrencyInfo;
    onClick: () => void;
}

const CurrencyCard: React.FC<CurrencyCardProps> = ({ title, currencyInfo, onClick }) => {
    const getExpiryStyle = (days: number | null, isCurrent: boolean) => {
        if (!isCurrent) return { text: 'text-gray-800', bg: 'bg-gray-100', label: '횟수 부족' };
        if (days === null || days < 0) return { text: 'text-white', bg: 'bg-black', label: '만료됨' };
        
        const label = `D-${days}`;
        if (days <= 7) return { text: 'text-red-800', bg: 'bg-red-100', label };
        if (days <= 30) return { text: 'text-orange-800', bg: 'bg-orange-100', label };
        return { text: 'text-lime-800', bg: 'bg-lime-200', label };
    };
    
    const style = getExpiryStyle(currencyInfo.daysUntilExpiry, currencyInfo.isCurrent);

    return (
        <div onClick={onClick} className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer transform hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
            <div className="mt-4 text-center">
                <p className="text-3xl font-bold text-gray-900">
                    {currencyInfo.count} <span className="text-base font-medium text-gray-500">/ 3회</span>
                </p>
                <p className="text-sm text-gray-500">(최근 60일)</p>
            </div>
            <div className={`mt-4 p-3 rounded-lg text-center ${style.bg}`}>
                <p className={`text-sm font-bold ${style.text}`}>{style.label}</p>
                <p className={`text-xs ${style.text}`}>
                    {currencyInfo.expiryDate ? `${currencyInfo.expiryDate} 만료 예정` : '자격 미충족'}
                </p>
            </div>
        </div>
    );
};

export default CurrencyCard;
