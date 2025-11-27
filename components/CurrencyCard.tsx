
import React, { memo } from 'react';
import { CurrencyInfo } from '../types';

interface CurrencyCardProps {
    title: string;
    currencyInfo: CurrencyInfo;
    onClick: () => void;
    cardType?: string;
    expiryDate?: string;
}

const CurrencyCard: React.FC<CurrencyCardProps> = memo(({ title, currencyInfo, onClick, cardType, expiryDate }) => {
    // currencyInfo가 undefined인 경우 기본값 제공
    if (!currencyInfo) {
        return (
            <div className="glass-card rounded-2xl p-4 sm:p-6 cursor-pointer flex flex-col justify-center h-full min-h-[120px] sm:min-h-[140px]">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-200">{title}</h3>
                </div>
                <div className="mt-2 text-center flex-1 flex flex-col justify-center">
                    <p className="text-3xl font-bold text-white">
                        0 <span className="text-base font-medium text-slate-400">/ 3회</span>
                    </p>
                    <p className="text-sm text-slate-400">(최근 90일)</p>
                </div>
                <div className="mt-3 py-2 px-3 rounded-lg text-center bg-white/5">
                    <p className="text-sm font-bold text-slate-400">데이터 없음</p>
                    <p className="text-xs text-slate-500">자격 정보를 불러올 수 없습니다</p>
                </div>
            </div>
        );
    }

    const getExpiryStyle = (days: number | null, isCurrent: boolean) => {
        if (!isCurrent) return { text: 'text-gray-200', bg: 'bg-gray-700 dark:bg-gray-800', label: '횟수 부족' };
        if (days === null || days < 0) return { text: 'text-gray-200', bg: 'bg-gray-700 dark:bg-gray-800', label: '만료됨' };

        const label = `D-${days}`;
        if (days <= 7) return { text: 'text-black dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', label };
        if (days <= 30) return { text: 'text-black dark:text-orange-200', bg: 'bg-orange-100 dark:bg-orange-800', label };
        return { text: 'text-black dark:text-lime-200', bg: 'bg-lime-200 dark:bg-lime-700', label };
    };

    const getDocumentExpiryStyle = (expiryDate: string, cardType?: string) => {
        if (!expiryDate) return { text: 'text-gray-800 dark:text-white', daysText: '자격 미충족', countText: 'text-gray-800 dark:text-white', countDisplay: 'D-DAY' };

        // 한국 시간대 기준으로 오늘 날짜 계산
        const today = new Date();
        const koreanToday = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const expiry = new Date(expiryDate);
        const koreanExpiry = new Date(expiry.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const timeDiff = koreanExpiry.getTime() - koreanToday.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let daysText = '';
        let countDisplay = '';
        if (daysUntilExpiry <= 0) {
            daysText = '만료됨';
            countDisplay = 'D-0';
        } else if (daysUntilExpiry <= 30) {
            daysText = `D-${daysUntilExpiry}`;
            countDisplay = `D-${daysUntilExpiry}`;
        } else if (daysUntilExpiry <= 90) {
            daysText = `D-${daysUntilExpiry}`;
            countDisplay = `D-${daysUntilExpiry}`;
        } else if (daysUntilExpiry <= 180) {
            daysText = `D-${daysUntilExpiry}`;
            countDisplay = `D-${daysUntilExpiry}`;
        } else {
            daysText = `D-${daysUntilExpiry}`;
            countDisplay = `D-${daysUntilExpiry}`;
        }

        let textColor = 'text-gray-800 dark:text-white';
        let countColor = 'text-gray-800 dark:text-white';

        // White Card와 CRM Card는 다른 기준 적용
        if (cardType === 'whitecard' || cardType === 'crm') {
            if (daysUntilExpiry <= 7) {
                textColor = 'text-black dark:text-red-500';
                countColor = 'text-black dark:text-red-500';
            } else if (daysUntilExpiry <= 15) {
                textColor = 'text-black dark:text-orange-500';
                countColor = 'text-black dark:text-orange-500';
            } else if (daysUntilExpiry <= 30) {
                textColor = 'text-black dark:text-yellow-500';
                countColor = 'text-black dark:text-yellow-500';
            } else {
                textColor = 'text-green-600 dark:text-green-500';
                countColor = 'text-green-600 dark:text-green-500';
            }
        } else {
            // 다른 문서 카드들은 기존 기준 유지
            if (daysUntilExpiry <= 30) {
                textColor = 'text-black dark:text-red-500';
                countColor = 'text-black dark:text-red-500';
            } else if (daysUntilExpiry <= 90) {
                textColor = 'text-black dark:text-orange-500';
                countColor = 'text-black dark:text-orange-500';
            } else if (daysUntilExpiry <= 180) {
                textColor = 'text-black dark:text-yellow-500';
                countColor = 'text-black dark:text-yellow-500';
            } else {
                textColor = 'text-green-600 dark:text-green-500';
                countColor = 'text-green-600 dark:text-green-500';
            }
        }

        return { text: textColor, daysText, countText: countColor, countDisplay };
    };

    const formatExpiryDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 앞의 0 제거
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}. ${month}. ${day}. 만료 예정`;
    };

    const style = getExpiryStyle(currencyInfo.daysUntilExpiry, currencyInfo.isCurrent);

    // 여권, 비자, EPTA, Radio, White Card, CRM 카드인지 확인
    const isDocumentCard = cardType && ['passport', 'visa', 'epta', 'radio', 'whitecard', 'crm'].includes(cardType);

    if (isDocumentCard) {
        const documentStyle = getDocumentExpiryStyle(expiryDate || '', cardType);
        const formattedDate = expiryDate ? formatExpiryDate(expiryDate) : '';

        return (
            <div onClick={onClick} className="glass-card rounded-2xl p-4 sm:p-6 cursor-pointer flex flex-col justify-center h-full min-h-[120px] sm:min-h-[140px] group">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors">{title}</h3>
                </div>
                <div className="mt-2 text-center flex-1 flex flex-col justify-center">
                    <p className={`text-4xl font-bold ${documentStyle.countText}`}>
                        {documentStyle.countDisplay}
                    </p>
                </div>
                <div className="mt-3 py-2 px-3 rounded-lg text-center">
                    {formattedDate ? (
                        <p className="text-sm text-slate-200" style={{ fontSize: '0.8rem' }}>
                            {formattedDate}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400">
                            만기일을 입력해주세요.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div onClick={onClick} className="glass-card rounded-2xl p-4 sm:p-6 cursor-pointer flex flex-col justify-center h-full min-h-[120px] sm:min-h-[140px] group">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors">{title}</h3>
            </div>
            <div className="mt-2 text-center flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-white">
                    {currencyInfo.count} <span className="text-base font-medium text-slate-400">/ 3회</span>
                </p>
                <p className="text-sm text-slate-400">(최근 90일)</p>
            </div>
            <div className={`mt-3 py-2 px-3 rounded-lg text-center ${style.bg}`}>
                <p className={`text-sm font-bold ${style.text}`}>{style.label}</p>
                <p className={`text-xs ${style.text}`} style={{ fontSize: '0.65rem' }}>
                    {expiryDate ? `${expiryDate} 만료 예정` : currencyInfo.expiryDate ? `${currencyInfo.expiryDate} 만료 예정` : '자격 미충족'}
                </p>
            </div>
        </div>
    );
});

CurrencyCard.displayName = 'CurrencyCard';

export default CurrencyCard;
