// src/notifications.js
// Simple notification system for ORB alerts

let permissionGranted = false;

/**
 * Request browser notification permission from user
 * Call this once when the app loads
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    permissionGranted = (permission === 'granted');
    return permissionGranted;
  }

  return false;
};

/**
 * Show a browser notification
 * This creates the actual popup notification
 */
export const showNotification = (title, body, severity = 'medium') => {
  if (!permissionGranted) {
    console.log('Notification permission not granted');
    return;
  }

  // Pick an icon based on severity
  const icon = severity === 'critical' || severity === 'high' 
    ? '🚨' 
    : severity === 'medium' 
    ? '⚠️' 
    : 'ℹ️';

  const notification = new Notification(`${icon} ${title}`, {
    body: body,
    icon: '/favicon.ico', // You can add a custom icon file
    badge: '/favicon.ico',
    tag: 'orb-alert', // Groups notifications together
    requireInteraction: severity === 'critical', // Critical alerts stay until clicked
  });

  // Auto-close after 10 seconds for non-critical alerts
  if (severity !== 'critical') {
    setTimeout(() => notification.close(), 10000);
  }

  return notification;
};

/**
 * Check if we have notification permission
 */
export const hasNotificationPermission = () => {
  return permissionGranted;
};