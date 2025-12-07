// Service Worker registration and management
// This utility handles Service Worker registration, updates, and communication

interface ServiceWorkerMessage {
  type: string;
  data?: any;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = 'serviceWorker' in navigator;

  async register(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });


      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              this.showUpdateNotification();
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('Service Worker unregistered:', result);
      this.registration = null;
      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  async update(): Promise<void> {
    if (!this.registration) {
      return;
    }

    try {
      await this.registration.update();
    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    // Send message to waiting service worker
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  async cacheUrls(urls: string[]): Promise<void> {
    if (!this.registration || !this.registration.active) {
      return;
    }

    this.registration.active.postMessage({
      type: 'CACHE_URLS',
      data: { urls }
    });
  }

  async clearCache(cacheName?: string): Promise<void> {
    if (!this.registration || !this.registration.active) {
      return;
    }

    this.registration.active.postMessage({
      type: 'CLEAR_CACHE',
      data: { cacheName }
    });
  }

  private showUpdateNotification(): void {
    // Show a notification to the user about the update
    // System notification removed as per user request
    console.log('Update available');

    // You could also show an in-app notification
    this.dispatchUpdateEvent();
  }

  private dispatchUpdateEvent(): void {
    const event = new CustomEvent('sw-update-available', {
      detail: { registration: this.registration }
    });
    window.dispatchEvent(event);
  }

  // Check if service worker is controlling the page
  isControlling(): boolean {
    return !!navigator.serviceWorker.controller;
  }

  // Get registration status
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  // Check if service worker is supported
  isServiceWorkerSupported(): boolean {
    return this.isSupported;
  }
}

// Singleton instance
let serviceWorkerManagerInstance: ServiceWorkerManager | null = null;

export const getServiceWorkerManager = (): ServiceWorkerManager => {
  if (!serviceWorkerManagerInstance) {
    serviceWorkerManagerInstance = new ServiceWorkerManager();
  }
  return serviceWorkerManagerInstance;
};

// Registration function
export const registerServiceWorker = async (): Promise<boolean> => {
  const manager = getServiceWorkerManager();
  return await manager.register();
};

// Update notification handler
export const handleServiceWorkerUpdate = (callback: (registration: ServiceWorkerRegistration) => void) => {
  window.addEventListener('sw-update-available', (event: any) => {
    callback(event.detail.registration);
  });
};

// Background sync registration
export const registerBackgroundSync = async (tag: string): Promise<void> => {
  if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
    console.warn('Background sync not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Background sync는 일부 브라우저에서만 지원됨
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      console.log('Background sync registered:', tag);
    } else {
      console.log('Background sync not supported in this browser');
    }
  } catch (error) {
    console.error('Background sync registration failed:', error);
  }
};

// Push notification permission request
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Notification permission request failed:', error);
    return 'denied';
  }
};

// Offline detection
export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const onOnlineStatusChange = (callback: (isOnline: boolean) => void): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
