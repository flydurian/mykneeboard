// 여권/비자 만료일 경고 관련 유틸리티 함수들

export interface PassportVisaData {
    type: 'passport' | 'visa';
    name: string;
    expiryDate: string; // YYYY-MM-DD 형식
}

export interface WarningData {
    type: 'passport' | 'visa';
    name: string;
    expiryDate: string;
    daysUntilExpiry: number;
}

// 6개월 전 경고 기준 (180일)
const WARNING_DAYS = 180;

// 1주일간 팝업 금지 키
const DISMISS_WARNING_KEY = 'passport_visa_warning_dismissed';

/**
 * 여권/비자 만료일 경고가 필요한 항목들을 계산
 */
export function calculateWarnings(passportVisaData: PassportVisaData[]): WarningData[] {
    const today = new Date();
    const warnings: WarningData[] = [];

    passportVisaData.forEach(item => {
        const expiryDate = new Date(item.expiryDate);
        const timeDiff = expiryDate.getTime() - today.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // 6개월(180일) 이내 만료되는 경우 경고
        if (daysUntilExpiry <= WARNING_DAYS && daysUntilExpiry > 0) {
            warnings.push({
                type: item.type,
                name: item.name,
                expiryDate: item.expiryDate,
                daysUntilExpiry
            });
        }
    });

    // 만료일이 가까운 순으로 정렬
    return warnings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * 1주일간 팝업 금지 설정
 */
export function dismissWarningForWeek(): void {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 7); // 1주일 후
    
    localStorage.setItem(DISMISS_WARNING_KEY, dismissUntil.toISOString());
}

/**
 * 1주일간 팝업 금지 상태 확인
 */
export function isWarningDismissed(): boolean {
    const dismissedUntil = localStorage.getItem(DISMISS_WARNING_KEY);
    
    if (!dismissedUntil) {
        return false;
    }

    const dismissDate = new Date(dismissedUntil);
    const now = new Date();

    // 금지 기간이 지났으면 false 반환
    if (now > dismissDate) {
        localStorage.removeItem(DISMISS_WARNING_KEY);
        return false;
    }

    return true;
}

/**
 * 샘플 여권/비자 데이터 (실제로는 사용자 설정에서 가져와야 함)
 */
export function getSamplePassportVisaData(): PassportVisaData[] {
    return [
        {
            type: 'passport',
            name: '대한민국 여권',
            expiryDate: '2025-03-15' // 6개월 이내 만료 예시
        },
        {
            type: 'visa',
            name: '미국 비자',
            expiryDate: '2025-06-20' // 6개월 이내 만료 예시
        },
        {
            type: 'passport',
            name: '대한민국 여권',
            expiryDate: '2026-12-31' // 6개월 이후 만료 (경고 대상 아님)
        }
    ];
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 한국어 날짜 형식으로 포맷 (YYYY년 MM월 DD일)
 */
export function formatKoreanDate(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
}
