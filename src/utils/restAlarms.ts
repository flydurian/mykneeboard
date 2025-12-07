// 휴식 구간 알람 유틸리티

export interface RestPeriod {
    name: string;
    endTime: Date;
}

let alarmTimer: NodeJS.Timeout | null = null;

/**
 * 다음 휴식 구간 알람을 설정합니다 (15분 전)
 */
export function scheduleNextRestAlarm(periods: RestPeriod[]) {
    // 기존 타이머 정리
    if (alarmTimer) {
        clearTimeout(alarmTimer);
        alarmTimer = null;
    }

    const now = new Date();

    // 15분 전 알람이 필요한 구간 찾기
    const upcomingPeriods = periods
        .map(period => ({
            ...period,
            alarmTime: new Date(period.endTime.getTime() - 15 * 60 * 1000) // 15분 전
        }))
        .filter(period => period.alarmTime > now) // 아직 지나지 않은 알람만
        .sort((a, b) => a.alarmTime.getTime() - b.alarmTime.getTime()); // 시간순 정렬

    if (upcomingPeriods.length === 0) {
        console.log('No upcoming rest period alarms');
        return;
    }

    const nextPeriod = upcomingPeriods[0];
    const timeUntilAlarm = nextPeriod.alarmTime.getTime() - now.getTime();

    console.log(`Next rest alarm scheduled for ${nextPeriod.name} in ${Math.round(timeUntilAlarm / 1000 / 60)} minutes`);

    // 다음 알람 시간에 타이머 설정
    alarmTimer = setTimeout(() => {
        // 커스텀 이벤트 발생
        const event = new CustomEvent('rest-alarm', {
            detail: { periodName: nextPeriod.name }
        });
        window.dispatchEvent(event);

        // 다음 알람 예약
        scheduleNextRestAlarm(periods);
    }, timeUntilAlarm);
}

/**
 * 모든 알람 취소
 */
export function cancelRestAlarms() {
    if (alarmTimer) {
        clearTimeout(alarmTimer);
        alarmTimer = null;
        console.log('Rest alarms cancelled');
    }
}

/**
 * 비행 정보로부터 휴식 구간 계산
 */
export function calculateRestPeriods(
    departureTime: string, // "0200" 형식
    flightTimeMinutes: number,
    timeZone: number
): RestPeriod[] {
    const periods: RestPeriod[] = [];

    // 이륙 시간 계산 (UTC)
    const depHours = parseInt(departureTime.slice(0, 2));
    const depMinutes = parseInt(departureTime.slice(2, 4));

    const now = new Date();
    const departureDate = new Date(now);
    departureDate.setUTCHours(depHours, depMinutes, 0, 0);

    // 만약 이륙 시간이 과거라면 다음 날로 설정
    if (departureDate < now) {
        departureDate.setDate(departureDate.getDate() + 1);
    }

    // 예시: CRZ 1, CRZ 2 등의 구간 (실제 로직은 RestCalculator의 타임라인 데이터 사용)
    // 여기서는 간단한 예시로 구현
    const halfFlightTime = Math.floor(flightTimeMinutes / 2);

    // CRZ 1 종료 시간 (비행 시간의 절반)
    const crz1End = new Date(departureDate.getTime() + halfFlightTime * 60 * 1000);
    periods.push({
        name: 'CRZ 1',
        endTime: crz1End
    });

    // CRZ 2 종료 시간 (착륙 시간)
    const crz2End = new Date(departureDate.getTime() + flightTimeMinutes * 60 * 1000);
    periods.push({
        name: 'CRZ 2',
        endTime: crz2End
    });

    return periods;
}
