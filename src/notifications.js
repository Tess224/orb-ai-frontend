// src/notifications.js
// Simple notification system for ORB alerts

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
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

export const showNotification = (title, body, severity = 'medium') => {
  // Always check current permission state
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  const icon = severity === 'critical' || severity === 'high' 
    ? '🚨' 
    : severity === 'medium' 
    ? '⚠️' 
    : 'ℹ️';

  try {
    const notification = new Notification(`${icon} ${title}`, {
      body: body,
      // Don't use favicon.ico - it 404s. Use a data URL or no icon.
      tag: `orb-alert-${Date.now()}`, // Unique tag to allow multiple notifications
      requireInteraction: severity === 'critical',
    });

    // Auto-close non-critical notifications after 10 seconds
    if (severity !== 'critical') {
      setTimeout(() => notification.close(), 10000);
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

export const hasNotificationPermission = () => {
  return Notification.permission === 'granted';
};