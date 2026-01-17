import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { enableTokenAlerts, disableTokenAlerts, getAlertStatus, getTokenAlerts } from '../api';

export function AlertButton({ tokenAddress }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [showAlertList, setShowAlertList] = useState(false);
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState(null); // NEW: Track when we last checked

  // Check alert status and notification permission on mount
  useEffect(() => {
    checkAlertStatus();
    setNotificationPermission(Notification.permission);
  }, [tokenAddress]);

  // Poll for new alerts when enabled
  useEffect(() => {
    if (!alertsEnabled) return;

    const pollAlerts = async () => {
      try {
        console.log('[AlertButton] Polling for alerts...', tokenAddress.slice(0, 8));
        const result = await getTokenAlerts(tokenAddress, 10);
        
        if (result.success) {
          console.log('[AlertButton] Got alerts response:', result);
          
          // NEW: Better logic for detecting new alerts
          // Only show notifications for alerts that arrived after we started monitoring
          const newAlerts = result.alerts.filter(alert => {
            // If this is our first check, don't notify about old alerts
            if (lastCheckedTimestamp === null) {
              return false;
            }
            // Only notify about alerts newer than our last check
            return alert.timestamp > lastCheckedTimestamp;
          });

          console.log('[AlertButton] New alerts since last check:', newAlerts.length);

          // Update our last checked timestamp to now
          setLastCheckedTimestamp(Date.now() / 1000);

          // Show notification for new alerts
          if (newAlerts.length > 0 && Notification.permission === 'granted') {
            console.log('[AlertButton] Showing notification for:', newAlerts[0]);
            
            const latest = newAlerts[0];
            const notification = new Notification(`ORB Alert: ${tokenAddress.slice(0, 6)}...`, {
              body: latest.message,
              icon: '/favicon.ico', // Use your actual icon path
              tag: `orb-alert-${tokenAddress}`, // This prevents duplicate notifications
              requireInteraction: latest.severity === 'critical',
              badge: '/favicon.ico'
            });

            // Log when notification is shown
            notification.onshow = () => {
              console.log('[AlertButton] Notification displayed!');
            };

            // Log if notification fails
            notification.onerror = (error) => {
              console.error('[AlertButton] Notification error:', error);
            };
          } else if (newAlerts.length > 0 && Notification.permission !== 'granted') {
            console.warn('[AlertButton] Have new alerts but no notification permission');
          }

          // Always update the recent alerts list so user can see them in the dropdown
          setRecentAlerts(result.alerts);
        }
      } catch (error) {
        console.error('[AlertButton] Error polling alerts:', error);
      }
    };

    // Set initial timestamp when we first enable alerts
    setLastCheckedTimestamp(Date.now() / 1000);
    
    // Do an initial poll immediately
    pollAlerts();
    
    // Then poll every 10 seconds
    const interval = setInterval(pollAlerts, 10000);
    return () => clearInterval(interval);
  }, [alertsEnabled, tokenAddress]);

  const checkAlertStatus = async () => {
    try {
      console.log('[AlertButton] Checking alert status for:', tokenAddress.slice(0, 8));
      const result = await getAlertStatus(tokenAddress);
      if (result.success) {
        console.log('[AlertButton] Alert status:', result.alerts_enabled);
        setAlertsEnabled(result.alerts_enabled);
      }
    } catch (error) {
      console.error('[AlertButton] Error checking alert status:', error);
    }
  };

  const requestNotificationPermission = async () => {
    console.log('[AlertButton] Requesting notification permission...');
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('[AlertButton] Permission result:', permission);
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const toggleAlerts = async () => {
    setLoading(true);
    try {
      if (!alertsEnabled) {
        // Request notification permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
          alert('Please enable browser notifications to receive alerts');
          setLoading(false);
          return;
        }

        console.log('[AlertButton] Enabling alerts...');
        // Enable alerts
        const result = await enableTokenAlerts(tokenAddress);
        console.log('[AlertButton] Enable result:', result);
        
        if (result.success) {
          setAlertsEnabled(true);
          // Reset timestamp so we only notify about future alerts
          setLastCheckedTimestamp(Date.now() / 1000);
        }
      } else {
        console.log('[AlertButton] Disabling alerts...');
        // Disable alerts
        const result = await disableTokenAlerts(tokenAddress);
        console.log('[AlertButton] Disable result:', result);
        
        if (result.success) {
          setAlertsEnabled(false);
          setLastCheckedTimestamp(null);
        }
      }
    } catch (error) {
      console.error('[AlertButton] Error toggling alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test notification button - useful for debugging
  const testNotification = () => {
    if (Notification.permission === 'granted') {
      console.log('[AlertButton] Sending test notification...');
      const notification = new Notification('ORB Test Alert', {
        body: 'This is a test notification. If you see this, notifications are working!',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });
      
      notification.onshow = () => {
        console.log('[AlertButton] Test notification displayed!');
      };
      
      notification.onerror = (error) => {
        console.error('[AlertButton] Test notification error:', error);
      };
    } else {
      alert('Notification permission not granted');
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          onClick={toggleAlerts}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
            alertsEnabled
              ? 'bg-green-600/20 border-green-500 text-green-400 hover:bg-green-600/30'
              : 'bg-gray-600/20 border-gray-500 text-gray-400 hover:bg-gray-600/30'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          <span className="text-sm font-bold">
            {loading ? 'Loading...' : alertsEnabled ? 'ALERTS ON' : 'ALERTS OFF'}
          </span>
          {recentAlerts.length > 0 && alertsEnabled && (
            <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {recentAlerts.length}
            </span>
          )}
        </button>

        {/* Test button - remove this after debugging */}
        {alertsEnabled && (
          <button
            onClick={testNotification}
            className="px-3 py-2 bg-purple-600/20 border-2 border-purple-500 text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-600/30"
          >
            Test 🔔
          </button>
        )}
      </div>

      {alertsEnabled && notificationPermission !== 'granted' && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-600/20 border border-yellow-500 text-yellow-400 text-xs p-2 rounded whitespace-nowrap">
          ⚠️ Enable browser notifications for alerts
        </div>
      )}

      {alertsEnabled && recentAlerts.length > 0 && (
        <button
          onClick={() => setShowAlertList(!showAlertList)}
          className="absolute -bottom-2 -right-2 bg-cyan-600/30 border border-cyan-500 text-cyan-400 text-xs px-2 py-1 rounded hover:bg-cyan-600/40"
        >
          {showAlertList ? 'Hide' : 'View'} Alerts
        </button>
      )}

      {showAlertList && recentAlerts.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-96 max-h-96 overflow-y-auto bg-black border-2 border-green-500 rounded-lg p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-green-400">Recent Alerts</span>
            <button
              onClick={() => setShowAlertList(false)}
              className="text-green-400/60 hover:text-green-400"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {recentAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`border-2 rounded p-2 ${
                  alert.severity === 'critical'
                    ? 'border-red-500 bg-red-600/10'
                    : alert.severity === 'high'
                    ? 'border-orange-500 bg-orange-600/10'
                    : alert.severity === 'medium'
                    ? 'border-yellow-500 bg-yellow-600/10'
                    : 'border-blue-500 bg-blue-600/10'
                }`}
              >
                <div className="text-xs font-bold mb-1">{alert.message}</div>
                <div className="text-xs opacity-60">{alert.time_ago}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}