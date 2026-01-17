import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, Wifi, WifiOff } from 'lucide-react';
import { enableTokenAlerts, disableTokenAlerts, getAlertStatus, getTokenAlerts } from '../api';
import { 
  showNotification, 
  initNotifications, 
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  testPushNotification
} from '../notifications';

export function AlertButton({ tokenAddress }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [showAlertList, setShowAlertList] = useState(false);
  
  // Use ref for timestamp to persist across renders without causing re-renders
  const lastCheckedRef = useRef(null);
  
  // Initialize notifications on mount
  useEffect(() => {
    const init = async () => {
      await initNotifications();
      // Check if already subscribed to push
      const subscribed = await isPushSubscribed();
      setPushEnabled(subscribed);
    };
    init();
  }, []);
  
  // Check alert status on mount
  useEffect(() => {
    checkAlertStatus();
  }, [tokenAddress]);

  // Poll for new alerts when enabled (backup for when push isn't working)
  useEffect(() => {
    if (!alertsEnabled || !tokenAddress) return;

    const pollAlerts = async () => {
      try {
        console.log('[AlertButton] Polling for alerts...', tokenAddress.slice(0, 8));
        const result = await getTokenAlerts(tokenAddress, 10);
        
        if (result.success && result.alerts) {
          console.log('[AlertButton] Got alerts:', result.alerts.length);
          
          // Filter for truly NEW alerts
          const newAlerts = result.alerts.filter(alert => {
            if (lastCheckedRef.current === null) return false;
            return alert.timestamp > lastCheckedRef.current;
          });

          console.log('[AlertButton] New alerts since last check:', newAlerts.length);

          // Show notification for each new alert (only if push not enabled - push handles its own)
          if (newAlerts.length > 0 && Notification.permission === 'granted' && !pushEnabled) {
            for (const alert of newAlerts) {
              await showNotification(
                `ORB: ${tokenAddress.slice(0, 6)}...`,
                alert.message,
                alert.severity
              );
            }
          }

          // Update timestamp
          lastCheckedRef.current = Date.now() / 1000;
          setRecentAlerts(result.alerts);
        }
      } catch (error) {
        console.error('[AlertButton] Polling error:', error);
      }
    };

    // Set initial timestamp
    lastCheckedRef.current = Date.now() / 1000;
    
    // Poll immediately, then every 10 seconds
    pollAlerts();
    const interval = setInterval(pollAlerts, 10000);
    
    return () => clearInterval(interval);
  }, [alertsEnabled, tokenAddress, pushEnabled]);

  const checkAlertStatus = async () => {
    if (!tokenAddress) return;
    try {
      const result = await getAlertStatus(tokenAddress);
      if (result.success) {
        setAlertsEnabled(result.alerts_enabled);
      }
    } catch (error) {
      console.error('[AlertButton] Status check error:', error);
    }
  };

  // Toggle alerts on/off
  const toggleAlerts = async () => {
    setLoading(true);
    try {
      if (!alertsEnabled) {
        // Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
          alert('Please enable browser notifications to receive alerts');
          setLoading(false);
          return;
        }

        // Enable on backend
        const result = await enableTokenAlerts(tokenAddress);
        if (result.success) {
          setAlertsEnabled(true);
          lastCheckedRef.current = Date.now() / 1000;
          
          // Offer to enable push notifications
          if (!pushEnabled) {
            const wantPush = confirm(
              'Alerts enabled! Would you also like to receive notifications even when the browser is closed?\n\n' +
              'This requires additional permission but ensures you never miss an alert.'
            );
            if (wantPush) {
              await enablePush();
            }
          }
        }
      } else {
        // Disable alerts
        const result = await disableTokenAlerts(tokenAddress);
        if (result.success) {
          setAlertsEnabled(false);
          lastCheckedRef.current = null;
        }
      }
    } catch (error) {
      console.error('[AlertButton] Toggle error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enable Web Push notifications
  const enablePush = async () => {
    setLoading(true);
    try {
      const success = await subscribeToPush(tokenAddress);
      if (success) {
        setPushEnabled(true);
        alert('✅ Push notifications enabled! You will receive alerts even when the browser is closed.');
      } else {
        alert('Failed to enable push notifications. Make sure notifications are allowed in your browser settings.');
      }
    } catch (error) {
      console.error('[AlertButton] Push enable error:', error);
      alert('Error enabling push: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Disable Web Push
  const disablePush = async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setPushEnabled(false);
    } catch (error) {
      console.error('[AlertButton] Push disable error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test notification
  const testNotification = async () => {
    if (Notification.permission !== 'granted') {
      alert('Notification permission not granted');
      return;
    }

    if (pushEnabled) {
      // Test via server push
      console.log('[AlertButton] Testing push notification...');
      const success = await testPushNotification();
      if (!success) {
        // Fallback to local notification
        await showNotification('ORB Test', 'Push test failed, but local notifications work!', 'medium');
      }
    } else {
      // Test local notification
      await showNotification('ORB Test', 'If you see this, notifications work!', 'medium');
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Main Alert Toggle Button */}
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

        {/* Push Notification Toggle (only show when alerts are on) */}
        {alertsEnabled && (
          <button
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={loading}
            title={pushEnabled ? 'Push ON - Click to disable' : 'Enable push notifications (works when browser closed)'}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
              pushEnabled
                ? 'bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600/30'
                : 'bg-gray-600/20 border-gray-500 text-gray-400 hover:bg-gray-600/30'
            }`}
          >
            {pushEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-xs font-bold hidden sm:inline">
              {pushEnabled ? 'PUSH' : 'PUSH OFF'}
            </span>
          </button>
        )}

        {/* Test Button */}
        {alertsEnabled && (
          <button
            onClick={testNotification}
            className="px-3 py-2 bg-purple-600/20 border-2 border-purple-500 text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-600/30"
          >
            Test 🔔
          </button>
        )}
      </div>

      {/* Permission Warning */}
      {alertsEnabled && Notification.permission !== 'granted' && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-600/20 border border-yellow-500 text-yellow-400 text-xs p-2 rounded whitespace-nowrap z-50">
          ⚠️ Enable browser notifications for alerts
        </div>
      )}

      {/* Push Status Indicator */}
      {alertsEnabled && pushEnabled && (
        <div className="absolute top-full mt-2 left-0 bg-blue-600/20 border border-blue-500 text-blue-400 text-xs p-2 rounded whitespace-nowrap z-50">
          ✅ Push enabled - Alerts work even when browser is closed
        </div>
      )}

      {/* View Alerts Button */}
      {alertsEnabled && recentAlerts.length > 0 && (
        <button
          onClick={() => setShowAlertList(!showAlertList)}
          className="absolute -bottom-2 -right-2 bg-cyan-600/30 border border-cyan-500 text-cyan-400 text-xs px-2 py-1 rounded hover:bg-cyan-600/40"
        >
          {showAlertList ? 'Hide' : 'View'} Alerts
        </button>
      )}

      {/* Alert List Dropdown */}
      {showAlertList && recentAlerts.length > 0 && (
        <div className="absolute top-full mt-8 left-0 w-96 max-h-96 overflow-y-auto bg-black border-2 border-green-500 rounded-lg p-3 z-50">
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
