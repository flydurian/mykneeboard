// Rest Calculator Notification Utilities
// Handles scheduling and managing notifications for rest periods

export interface RestNotification {
    id: string;
    type: 'rest-start-warning' | 'rest-end-warning';
    title: string;
    body: string;
    scheduledTime: number; // Unix timestamp in milliseconds
    timeoutId?: number;
}

export interface RestSchedule {
    departureTime: Date;
    restStartTime: Date;
    restEndTime: Date;
    landingTime: Date;
}

/**
 * Request notification permission from the user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported in this browser');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        console.warn('Notification permission previously denied');
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission;
    } catch (error) {
        console.error('Failed to request notification permission:', error);
        return 'denied';
    }
};

/**
 * Check if notifications are supported and permitted
 */
export const canShowNotifications = (): boolean => {
    return 'Notification' in window && Notification.permission === 'granted';
};

/**
 * Calculate rest schedule based on flight parameters
 * @param departureTimeUTC - Departure time in HHMM format (UTC)
 * @param afterTakeoffMinutes - Minutes after takeoff when rest starts
 * @param restDurationMinutes - Duration of rest period in minutes
 * @param beforeLandingMinutes - Minutes before landing when duty resumes
 */
export const calculateRestSchedule = (
    departureTimeUTC: string,
    afterTakeoffMinutes: number,
    restDurationMinutes: number,
    beforeLandingMinutes: number
): RestSchedule => {
    // Parse departure time (HHMM format)
    const hours = parseInt(departureTimeUTC.slice(0, 2), 10) || 0;
    const minutes = parseInt(departureTimeUTC.slice(2, 4), 10) || 0;

    // Create departure time (today or tomorrow based on current time)
    const now = new Date();
    const departure = new Date();
    departure.setHours(hours, minutes, 0, 0);

    // If departure time is in the past, assume it's tomorrow
    if (departure.getTime() < now.getTime()) {
        departure.setDate(departure.getDate() + 1);
    }

    // Calculate rest start time (departure + afterTakeoff)
    const restStart = new Date(departure.getTime() + afterTakeoffMinutes * 60 * 1000);

    // Calculate rest end time (restStart + restDuration)
    const restEnd = new Date(restStart.getTime() + restDurationMinutes * 60 * 1000);

    // Calculate landing time (restEnd + beforeLanding)
    const landing = new Date(restEnd.getTime() + beforeLandingMinutes * 60 * 1000);

    return {
        departureTime: departure,
        restStartTime: restStart,
        restEndTime: restEnd,
        landingTime: landing
    };
};

/**
 * Schedule notifications for a rest period
 * @param schedule - Rest schedule with key time points
 * @returns Array of scheduled notifications
 */
export const scheduleRestNotifications = (schedule: RestSchedule): RestNotification[] => {
    const notifications: RestNotification[] = [];
    const now = Date.now();

    // Helper to format time in UTC (HHMM format)
    const formatUTC = (date: Date): string => {
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // Helper to format time in local timezone (HHMM format)
    const formatLocal = (date: Date): string => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // Helper to create notification
    const createNotification = (
        type: RestNotification['type'],
        title: string,
        body: string,
        time: Date
    ): RestNotification | null => {
        const scheduledTime = time.getTime();

        // Don't schedule notifications in the past
        if (scheduledTime <= now) {
            return null;
        }

        const id = `${type}-${scheduledTime}`;
        return {
            id,
            type,
            title,
            body,
            scheduledTime
        };
    };

    // 1. 근무 종료 15분 전 (= 휴식 시작 15분 전)
    const dutyEndWarning = new Date(schedule.restStartTime.getTime() - 15 * 60 * 1000);
    const dutyEndTimeUTC = formatUTC(schedule.restStartTime);
    const dutyEndTimeLocal = formatLocal(schedule.restStartTime);

    const warning1 = createNotification(
        'rest-start-warning',
        '근무 종료 15분 전입니다',
        `종료시간: ${dutyEndTimeUTC}Z / ${dutyEndTimeLocal}`,
        dutyEndWarning
    );
    if (warning1) notifications.push(warning1);

    // 2. 휴식 종료 15분 전 (= 근무 재개 15분 전)
    const restEndWarning = new Date(schedule.restEndTime.getTime() - 15 * 60 * 1000);
    const restEndTimeUTC = formatUTC(schedule.restEndTime);
    const restEndTimeLocal = formatLocal(schedule.restEndTime);

    const warning2 = createNotification(
        'rest-end-warning',
        '휴식 종료 15분 전입니다',
        `종료시간: ${restEndTimeUTC}Z / ${restEndTimeLocal}`,
        restEndWarning
    );
    if (warning2) notifications.push(warning2);

    return notifications;
};

/**
 * Show a notification using Service Worker
 * @param notification - Notification to show
 */
export const showNotification = async (notification: RestNotification): Promise<void> => {
    if (!canShowNotifications()) {
        console.warn('Cannot show notification - permission not granted');
        return;
    }

    try {
        // Vibrate on mobile devices for better awareness
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        // Check if Service Worker is available
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            // Use Service Worker to show notification
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title, {
                body: notification.body,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: notification.id,
                requireInteraction: false,
                vibrate: [200, 100, 200],
                data: {
                    type: notification.type,
                    scheduledTime: notification.scheduledTime
                }
            });
            console.log('✅ Notification shown via Service Worker:', notification.title, notification.body);
        } else {
            // Fallback to regular notification
            new Notification(notification.title, {
                body: notification.body,
                icon: '/icon-192x192.png',
                tag: notification.id,
                vibrate: [200, 100, 200]
            });
            console.log('✅ Notification shown (fallback):', notification.title, notification.body);
        }
    } catch (error) {
        console.error('❌ Failed to show notification:', error);
    }
};

/**
 * Schedule notifications using setTimeout
 * Note: This only works while the app is open. For background notifications,
 * we would need to use the Notification API's scheduled notifications (not widely supported)
 * or a backend service.
 */
export const activateNotifications = (
    notifications: RestNotification[],
    onNotificationShown?: (notification: RestNotification) => void
): RestNotification[] => {
    const now = Date.now();

    return notifications.map(notification => {
        const delay = notification.scheduledTime - now;

        if (delay <= 0) {
            // Notification time has passed
            return notification;
        }

        // Schedule notification
        const timeoutId = window.setTimeout(() => {
            showNotification(notification);
            if (onNotificationShown) {
                onNotificationShown(notification);
            }
        }, delay);

        return {
            ...notification,
            timeoutId
        };
    });
};

/**
 * Cancel all scheduled notifications
 */
export const cancelNotifications = (notifications: RestNotification[]): void => {
    notifications.forEach(notification => {
        if (notification.timeoutId) {
            window.clearTimeout(notification.timeoutId);
        }
    });
    console.log(`Cancelled ${notifications.length} notifications`);
};

/**
 * Format time for display
 */
export const formatNotificationTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Get notification status summary
 */
export const getNotificationStatus = (notifications: RestNotification[]): {
    total: number;
    scheduled: number;
    past: number;
    nextNotification: RestNotification | null;
} => {
    const now = Date.now();
    const scheduled = notifications.filter(n => n.scheduledTime > now);
    const past = notifications.filter(n => n.scheduledTime <= now);

    const nextNotification = scheduled.length > 0
        ? scheduled.reduce((earliest, current) =>
            current.scheduledTime < earliest.scheduledTime ? current : earliest
        )
        : null;

    return {
        total: notifications.length,
        scheduled: scheduled.length,
        past: past.length,
        nextNotification
    };
};
