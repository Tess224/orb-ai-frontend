// public/sw.js
// Service Worker for ORB - Handles both local and push notifications

// Install event - cache important assets if needed
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim()); // Take control of all pages immediately
});

// ============================================
// PUSH NOTIFICATIONS (from server)
// ============================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
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
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }
  
  // Determine icon/badge based on severity
  const severityEmoji = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '📊',
    'low': 'ℹ️'
  };
  
  const emoji = severityEmoji[data.severity] || '📊';
  
  // Build notification options
  const options = {
    body: data.body,
    tag: `orb-push-${data.token_address || 'general'}-${Date.now()}`,
    requireInteraction: data.severity === 'critical',
    vibrate: data.severity === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      url: '/', // URL to open when notification is clicked
      token_address: data.token_address,
      severity: data.severity,
      timestamp: data.timestamp
    },
    actions: [
      {
        action: 'view',
        title: 'View Token'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  // Show the notification
  const title = data.title || `${emoji} ORB Alert`;
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================
// NOTIFICATION CLICK HANDLING
// ============================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  // Handle different actions
  if (action === 'dismiss') {
    return; // Just close the notification
  }
  
  // Default action or 'view' action - open/focus the app
  let urlToOpen = '/';
  
  // If there's a token address, go to that token's analysis
  if (data.token_address) {
    urlToOpen = `/?token=${data.token_address}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes('orb-ai-frontend') && 'focus' in client) {
          // Navigate to the token if specified
          if (data.token_address) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      
      // App not open - open new window
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
  // You could send analytics here if needed
});

// ============================================
// BACKGROUND SYNC (for future use)
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-alerts') {
    // Could be used to sync alerts when connection is restored
    event.waitUntil(
      // Sync logic here
      Promise.resolve()
    );
  }
});

// ============================================
// MESSAGE HANDLING (from main app)
// ============================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    // Allow main app to trigger notifications through SW
    const { title, body, severity, token_address } = event.data;
    
    self.registration.showNotification(title, {
      body: body,
      tag: `orb-local-${Date.now()}`,
      requireInteraction: severity === 'critical',
      data: { token_address, severity }
    });
  }
});

console.log('[SW] Service Worker script loaded');
