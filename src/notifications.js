// src/notifications.js
// Comprehensive notification system for ORB
// Supports: Local notifications (desktop), Service Worker notifications (mobile), and Web Push (background)

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://orbonsolana.up.railway.app';

let serviceWorkerRegistration = null;
let pushSubscription = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the notification system.
 * This registers the service worker and sets up push subscription.
 * Call this once when your app starts.
 */
export const initNotifications = async () => {
  // Check browser support
  if (!('Notification' in window)) {
    console.warn('[Notifications] Browser does not support notifications');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[Notifications] Browser does not support service workers');
    return false;
  }

  try {
    // Register service worker
    serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Notifications] Service Worker registered:', serviceWorkerRegistration.scope);
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('[Notifications] Service Worker is ready');
    
    return true;
  } catch (error) {
    console.error('[Notifications] Service Worker registration failed:', error);
    return false;
  }
};

// ============================================
// PERMISSION HANDLING
// ============================================

/**
 * Request notification permission from the user.
 * Returns true if granted, false otherwise.
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
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

/**
 * Check if notification permission is granted.
 */
export const hasNotificationPermission = () => {
  return Notification.permission === 'granted';
};

// ============================================
// LOCAL/SERVICE WORKER NOTIFICATIONS
// ============================================

/**
 * Show a notification using the best available method.
 * Works on both desktop (Notification API) and mobile (Service Worker).
 */
export const showNotification = async (title, body, severity = 'medium') => {
  if (Notification.permission !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Add emoji based on severity
  const emoji = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '📊',
    'low': 'ℹ️'
  }[severity] || '📊';

  const fullTitle = `${emoji} ${title}`;
  const options = {
    body: body,
    tag: `orb-alert-${Date.now()}`,
    requireInteraction: severity === 'critical',
  };

  try {
    // Try Service Worker method first (works on Android)
    if (serviceWorkerRegistration) {
      await serviceWorkerRegistration.showNotification(fullTitle, options);
      console.log('[Notifications] Shown via Service Worker');
      return true;
    }

    // Fallback: get any active service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        await registration.showNotification(fullTitle, options);
        console.log('[Notifications] Shown via ready SW');
        return true;
      }
    }

    // Last resort: direct Notification (desktop only)
    const notification = new Notification(fullTitle, options);
    console.log('[Notifications] Shown via Notification API');
    
    if (severity !== 'critical') {
      setTimeout(() => notification.close(), 10000);
    }
    return notification;

  } catch (error) {
    console.error('[Notifications] Failed:', error);
    
    // If "Illegal constructor" error on Android, try SW
    if (error.message?.includes('Illegal constructor')) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(fullTitle, options);
        return true;
      } catch (e) {
        console.error('[Notifications] SW fallback failed:', e);
      }
    }
    return null;
  }
};

// ============================================
// WEB PUSH SUBSCRIPTION
// ============================================

/**
 * Get the VAPID public key from the backend.
 * This key is needed to subscribe to push notifications.
 */
const getVapidPublicKey = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/push/vapid-public-key`);
    const data = await response.json();
    
    if (data.success && data.vapid_public_key) {
      return data.vapid_public_key;
    }
    return null;
  } catch (error) {
    console.error('[Push] Failed to get VAPID key:', error);
    return null;
  }
};

/**
 * Convert a base64 string to Uint8Array (needed for push subscription).
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Subscribe to Web Push notifications.
 * This allows the server to send notifications even when the app is closed.
 * 
 * @param {string} tokenAddress - Optional: only receive alerts for this token
 * @returns {boolean} True if subscription was successful
 */
export const subscribeToPush = async (tokenAddress = null) => {
  try {
    // Make sure we have permission
    if (Notification.permission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.log('[Push] Permission denied');
        return false;
      }
    }

    // Make sure service worker is ready
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Get VAPID key from backend
      const vapidKey = await getVapidPublicKey();
      
      if (!vapidKey) {
        console.error('[Push] Could not get VAPID key from server');
        console.log('[Push] Make sure VAPID_PUBLIC_KEY is set on your backend');
        return false;
      }

      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required: notifications must be visible
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      
      console.log('[Push] New subscription created');
    } else {
      console.log('[Push] Using existing subscription');
    }

    // Send subscription to backend
    const response = await fetch(`${BACKEND_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        token_address: tokenAddress
      })
    });

    const result = await response.json();
    
    if (result.success) {
      pushSubscription = subscription;
      console.log('[Push] Successfully subscribed to push notifications');
      return true;
    } else {
      console.error('[Push] Backend rejected subscription:', result.error);
      return false;
    }

  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return false;
  }
};

/**
 * Unsubscribe from Web Push notifications.
 */
export const unsubscribeFromPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Unsubscribe locally
      await subscription.unsubscribe();
      
      // Tell backend to remove subscription
      await fetch(`${BACKEND_URL}/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });
      
      pushSubscription = null;
      console.log('[Push] Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
};

/**
 * Check if currently subscribed to push notifications.
 */
export const isPushSubscribed = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Test push notifications by sending a test from the server.
 */
export const testPushNotification = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/push/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('[Push] Test failed:', error);
    return false;
  }
};
