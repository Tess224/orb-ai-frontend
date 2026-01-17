// src/notifications.js
// Cross-platform notification system for ORB alerts
// Works on both desktop (using Notification API) and mobile (using Service Worker)

let serviceWorkerRegistration = null;

// Register service worker on app start
export const initNotifications = async () => {
  // Check if browser supports notifications at all
  if (!('Notification' in window)) {
    console.warn('[Notifications] Browser does not support notifications');
    return false;
  }

  // Register service worker for mobile support
  if ('serviceWorker' in navigator) {
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Notifications] Service Worker registered:', serviceWorkerRegistration);
    } catch (error) {
      console.warn('[Notifications] Service Worker registration failed:', error);
      // Continue anyway - desktop notifications might still work
    }
  }

  return true;
};

// Request permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Show notification - works on both desktop and mobile
export const showNotification = async (title, body, severity = 'medium') => {
  // Check permission
  if (Notification.permission !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Add emoji based on severity
  const icon = severity === 'critical' || severity === 'high' 
    ? '🚨' 
    : severity === 'medium' 
    ? '⚠️' 
    : 'ℹ️';

  const fullTitle = `${icon} ${title}`;
  const options = {
    body: body,
    tag: `orb-alert-${Date.now()}`,
    requireInteraction: severity === 'critical',
  };

  try {
    // Try Service Worker method first (required for Android)
    if (serviceWorkerRegistration) {
      await serviceWorkerRegistration.showNotification(fullTitle, options);
      console.log('[Notifications] Shown via Service Worker');
      return true;
    }
    
    // Fallback: try getting any active service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        await registration.showNotification(fullTitle, options);
        console.log('[Notifications] Shown via ready Service Worker');
        return true;
      }
    }

    // Last resort: try direct Notification constructor (desktop only)
    const notification = new Notification(fullTitle, options);
    console.log('[Notifications] Shown via Notification constructor');
    
    // Auto-close non-critical notifications
    if (severity !== 'critical') {
      setTimeout(() => notification.close(), 10000);
    }
    
    return notification;
  } catch (error) {
    console.error('[Notifications] Failed to show notification:', error);
    
    // If the error is about illegal constructor, try one more time with SW
    if (error.message && error.message.includes('Illegal constructor')) {
      console.log('[Notifications] Trying Service Worker fallback...');
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(fullTitle, options);
        console.log('[Notifications] Fallback succeeded');
        return true;
      } catch (swError) {
        console.error('[Notifications] Service Worker fallback also failed:', swError);
      }
    }
    
    return null;
  }
};

// Check current permission status
export const hasNotificationPermission = () => {
  return Notification.permission === 'granted';
};
 