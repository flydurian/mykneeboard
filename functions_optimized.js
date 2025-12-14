/**
 * Optimized Cloud Functions for FCM Show Up Alarms
 * 
 * This function uses the `schedules/{date}` index to query efficiently.
 * It does NOT scan all users, saving significant database read costs.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { format, toZonedTime } = require("date-fns-tz");

admin.initializeApp();
const db = admin.database();

// 서울 시간대 기준
const TIME_ZONE = 'Asia/Seoul';

// 5분마다 실행
exports.checkShowUpAlarmsOptimized = functions.region('asia-northeast3').pubsub.schedule('every 5 minutes').timeZone(TIME_ZONE).onRun(async (context) => {
    const now = new Date();
    // 현재 시간부터 5분 뒤까지를 알림 대상으로 설정
    const endTime = new Date(now.getTime() + 5 * 60 * 1000);

    // 타임존 보정 (UTC -> KST 날짜 확인용)
    const nowZoned = toZonedTime(now, TIME_ZONE);
    const dateStr = format(nowZoned, 'yyyy-MM-dd', { timeZone: TIME_ZONE });

    // 내일 날짜도 확인 (자정 근처일 경우 쇼업 시간이 내일일 수 있음)
    const tomorrowZoned = toZonedTime(new Date(now.getTime() + 24 * 60 * 60 * 1000), TIME_ZONE);
    const tomorrowDateStr = format(tomorrowZoned, 'yyyy-MM-dd', { timeZone: TIME_ZONE });

    console.log(`⏰ Checking Alarms for ${dateStr} & ${tomorrowDateStr}`);

    // 오늘과 내일 날짜의 스케줄 인덱스만 조회
    const datesToCheck = [dateStr, tomorrowDateStr];
    const promises = [];

    for (const date of datesToCheck) {
        promises.push(db.ref(`schedules/${date}`).once('value'));
    }

    try {
        const snapshots = await Promise.all(promises);
        const alarmPromises = [];

        snapshots.forEach(dateSnap => {
            if (!dateSnap.exists()) return;

            // schedules/{date}/{userId}/{flightId} 구조
            dateSnap.forEach(userSnap => {
                const userId = userSnap.key;

                userSnap.forEach(flightSnap => {
                    const flightData = flightSnap.val();

                    if (!flightData.showUpDateTimeUtc) return;

                    const showUpTime = new Date(flightData.showUpDateTimeUtc);
                    // 알림 기준: Show Up 2시간 전
                    const alarmTime = new Date(showUpTime.getTime() - 2 * 60 * 60 * 1000);

                    // 알림 시간이 현재 주기(5분) 내에 포함되는지 확인
                    if (alarmTime >= now && alarmTime < endTime) {
                        // 유저의 토큰 가져오기 (필요한 유저만 조회)
                        const tokenPromise = db.ref(`users/${userId}/fcmTokens`).once('value').then(tokenSnap => {
                            if (!tokenSnap.exists()) return;

                            const fcmTokens = tokenSnap.val();
                            const tokens = Object.keys(fcmTokens);

                            if (tokens.length === 0) return;

                            // 메시지 포맷팅
                            const showUpDateZoned = toZonedTime(showUpTime, TIME_ZONE);
                            const showUpTimeStr = format(showUpDateZoned, 'HHmm', { timeZone: TIME_ZONE });

                            let etdTimeStr = 'Unknown';
                            let displayDateStr = format(showUpDateZoned, 'yy.MM.dd', { timeZone: TIME_ZONE }); // 앱 내 표시용 날짜

                            if (flightData.departureDateTimeUtc) {
                                const depUtc = new Date(flightData.departureDateTimeUtc);
                                const depDateZoned = toZonedTime(depUtc, TIME_ZONE);
                                etdTimeStr = format(depDateZoned, 'HHmm', { timeZone: TIME_ZONE });
                                displayDateStr = format(depDateZoned, 'yy.MM.dd', { timeZone: TIME_ZONE });
                            }

                            const message = {
                                notification: {
                                    title: `${displayDateStr} <${flightData.flightNumber}>`,
                                    body: `SHOW UP : ${showUpTimeStr} / ETD : ${etdTimeStr}`
                                },
                                data: {
                                    type: 'show-up-alarm',
                                    flightId: String(flightData.flightId)
                                },
                                // 높은 우선순위 설정 (잠금화면 노출 확률 증대)
                                android: {
                                    priority: 'high',
                                    notification: {
                                        priority: 'max',
                                        channelId: 'show_up_alarm_channel'
                                    }
                                },
                                webpush: {
                                    headers: {
                                        Urgency: 'high'
                                    },
                                    notification: {
                                        requireInteraction: true
                                    }
                                }
                            };

                            console.log(`🔔 Sending to ${userId}: ${message.notification.title}`);
                            return admin.messaging().sendToDevice(tokens, message);
                        });
                        alarmPromises.push(tokenPromise);
                    }
                });
            });
        });

        await Promise.all(alarmPromises);
        return null;

    } catch (error) {
        console.error('Check Alarm Error:', error);
        return null;
    }
});
