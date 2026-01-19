// public/sw.js
// Service Worker for ORB - Handles both local and push notifications
// Version: 2.0 (Improved background notification handling)

const CACHE_VERSION = 'orb-v2';

// Install event - cache important assets if needed
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...', CACHE_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated', CACHE_VERSION);
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[SW] Claimed all clients');
    })
  ); // Take control of all pages immediately
});

// ============================================
// PUSH NOTIFICATIONS (from server)
// ============================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);

  let data = {
    title: 'ORB Alert',
    body: 'New alert received',
    severity: 'medium',
    token_address: null
  };

  // Parse the push data
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[SW] Push data:', data);
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  // Determine emoji based on severity
  const severityEmoji = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '📊',
    'low': 'ℹ️'
  };

  const emoji = severityEmoji[data.severity] || '📊';

  // IMPORTANT: Use an actual icon URL for Android
  // This is critical for background notifications on mobile
  const iconUrl = '/orb-icon-192.png'; // You need to add this file
  const badgeUrl = '/orb-badge-96.png'; // You need to add this file

  // Build notification options (Android/Chrome requirements)
  const options = {
    body: data.body,
    icon: iconUrl, // REQUIRED for Android background notifications
    badge: badgeUrl, // REQUIRED for Chrome notifications
    tag: `orb-push-${data.token_address || 'general'}-${Date.now()}`,
    requireInteraction: data.severity === 'critical' || data.severity === 'high', // Keep visible for important alerts
    renotify: true, // Vibrate/sound again if same tag
    silent: false, // Play sound/vibration
    vibrate: data.severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200], // Vibration pattern
    timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
    data: {
      url: data.token_address ? `/?token=${data.token_address}` : '/',
      token_address: data.token_address,
      severity: data.severity,
      timestamp: data.timestamp
    },
    actions: [
      {
        action: 'view',
        title: '👁️ View',
        icon: '/action-view.png' // Optional
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss',
        icon: '/action-dismiss.png' // Optional
      }
    ]
  };

  // Show the notification
  const title = data.title || `${emoji} ORB Alert`;

  console.log('[SW] Showing notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[SW] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[SW] Failed to show notification:', error);
      })
  );
});

// ============================================
// NOTIFICATION CLICK HANDLING
// ============================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag, 'action:', event.action);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Handle different actions
  if (action === 'dismiss') {
    console.log('[SW] Notification dismissed by user');
    return; // Just close the notification
  }

  // Default action or 'view' action - open/focus the app
  const urlToOpen = data.url || '/';

  console.log('[SW] Opening URL:', urlToOpen);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('[SW] Found', clientList.length, 'open windows');

      // Check if app is already open
      for (const client of clientList) {
        if ('focus' in client) {
          console.log('[SW] Focusing existing window');
          // Navigate to the URL if specified
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }

      // App not open - open new window
      console.log('[SW] Opening new window');
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// NOTIFICATION CLOSE HANDLING (optional logging)
// ============================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
  // Could send analytics here
});

// ============================================
// BACKGROUND SYNC (for future use)
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-alerts') {
    event.waitUntil(
      // Could sync pending alerts when connection restored
      Promise.resolve()
    );
  }
});

// ============================================
// MESSAGE HANDLING (from main app)
// ============================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received from app:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    // Allow main app to trigger notifications through SW
    const { title, body, severity, token_address } = event.data;

    const iconUrl = '/orb-icon-192.png';
    const badgeUrl = '/orb-badge-96.png';

    self.registration.showNotification(title, {
      body: body,
      icon: iconUrl,
      badge: badgeUrl,
      tag: `orb-local-${Date.now()}`,
      requireInteraction: severity === 'critical',
      vibrate: [200, 100, 200],
      data: { token_address, severity }
    });
  }

  // Handle skip waiting request
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================
// PERIODIC BACKGROUND SYNC (Chrome 80+)
// ============================================

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'check-alerts') {
    event.waitUntil(
      // Could check for new alerts periodically
      Promise.resolve()
    );
  }
});

console.log('[SW] Service Worker script loaded -', CACHE_VERSION);
