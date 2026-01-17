// src/notifications.js
// Simple notification system for ORB alerts

let permissionGranted = false;

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

export const showNotification = (title, body, severity = 'medium') => {
  if (!permissionGranted) {
    console.log('Notification permission not granted');
    return;
  }

  const icon = severity === 'critical' || severity === 'high' 
    ? '🚨' 
    : severity === 'medium' 
    ? '⚠️' 
    : 'ℹ️';

  const notification = new Notification(`${icon} ${title}`, {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'orb-alert',
    requireInteraction: severity === 'critical',
  });

  if (severity !== 'critical') {
    setTimeout(() => notification.close(), 10000);
  }

  return notification;
};

export const hasNotificationPermission = () => {
  return permissionGranted;
};