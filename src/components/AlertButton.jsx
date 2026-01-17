import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { enableTokenAlerts, disableTokenAlerts, getAlertStatus, getTokenAlerts } from '../api';
import { showNotification, initNotifications, requestNotificationPermission } from '../notifications';

export function AlertButton({ tokenAddress }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [showAlertList, setShowAlertList] = useState(false);
  
  // Use a ref to track the timestamp - persists without causing re-renders
  const lastCheckedRef = useRef(null);
  
  // Initialize notifications on mount
  useEffect(() => {
    initNotifications();
  }, []);
  
  // Check alert status on mount
  useEffect(() => {
    checkAlertStatus();
  }, [tokenAddress]);

  // Poll for new alerts when enabled
  useEffect(() => {
    if (!alertsEnabled || !tokenAddress) return;

    const pollAlerts = async () => {
      try {
        console.log('[AlertButton] Polling for alerts...', tokenAddress.slice(0, 8));
        const result = await getTokenAlerts(tokenAddress, 10);
        
        if (result.success && result.alerts) {
          console.log('[AlertButton] Got alerts response:', result);
          
          // Filter for NEW alerts only
          const newAlerts = result.alerts.filter(alert => {
            if (lastCheckedRef.current === null) return false;
            return alert.timestamp > lastCheckedRef.current;
          });

          console.log('[AlertButton] New alerts since last check:', newAlerts.length);

          // Show notification for each new alert using the cross-platform function
          if (newAlerts.length > 0 && Notification.permission === 'granted') {
            for (const alert of newAlerts) {
              console.log('[AlertButton] Showing notification for:', alert.message);
              await showNotification(
                `ORB: ${tokenAddress.slice(0, 6)}...`,
                alert.message,
                alert.severity
              );
            }
          }

          // Update timestamp AFTER checking
          lastCheckedRef.current = Date.now() / 1000;

          // Always update the visible alerts list
          setRecentAlerts(result.alerts);
        }
      } catch (error) {
        console.error('[AlertButton] Error polling alerts:', error);
      }
    };

    // Set initial timestamp to NOW
    lastCheckedRef.current = Date.now() / 1000;
    
    // Poll immediately, then every 10 seconds
    pollAlerts();
    const interval = setInterval(pollAlerts, 10000);
    
    return () => clearInterval(interval);
  }, [alertsEnabled, tokenAddress]);

  const checkAlertStatus = async () => {
    if (!tokenAddress) return;
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
        const result = await enableTokenAlerts(tokenAddress);
        console.log('[AlertButton] Enable result:', result);
        
        if (result.success) {
          setAlertsEnabled(true);
          lastCheckedRef.current = Date.now() / 1000;
        }
      } else {
        console.log('[AlertButton] Disabling alerts...');
        const result = await disableTokenAlerts(tokenAddress);
        console.log('[AlertButton] Disable result:', result);
        
        if (result.success) {
          setAlertsEnabled(false);
          lastCheckedRef.current = null;
        }
      }
    } catch (error) {
      console.error('[AlertButton] Error toggling alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test notification using the cross-platform function
  const testNotification = async () => {
    if (Notification.permission !== 'granted') {
      alert('Notification permission not granted. Click ALERTS OFF first to request permission.');
      return;
    }
    
    console.log('[AlertButton] Sending test notification...');
    const result = await showNotification(
      'ORB Test',
      'If you see this, notifications work!',
      'medium'
    );
    
    if (result) {
      console.log('[AlertButton] Test notification sent successfully');
    } else {
      alert('Notification failed - check console for details');
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

        {/* Test button */}
        {alertsEnabled && (
          <button
            onClick={testNotification}
            className="px-3 py-2 bg-purple-600/20 border-2 border-purple-500 text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-600/30"
          >
            Test 🔔
          </button>
        )}
      </div>

      {alertsEnabled && Notification.permission !== 'granted' && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-600/20 border border-yellow-500 text-yellow-400 text-xs p-2 rounded whitespace-nowrap z-50">
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
