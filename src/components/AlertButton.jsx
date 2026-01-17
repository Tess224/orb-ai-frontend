import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { enableTokenAlerts, disableTokenAlerts, getAlertStatus, getTokenAlerts } from '../api';

export function AlertButton({ tokenAddress }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [showAlertList, setShowAlertList] = useState(false);

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
        const result = await getTokenAlerts(tokenAddress, 10);
        if (result.success) {
          // Check for new alerts
          const newAlerts = result.alerts.filter(alert => 
            !recentAlerts.some(existing => 
              existing.timestamp === alert.timestamp
            )
          );

          if (newAlerts.length > 0 && Notification.permission === 'granted') {
            // Show browser notification for most recent alert
            const latest = newAlerts[0];
            new Notification(`ORB Alert: ${tokenAddress.slice(0, 6)}...`, {
              body: latest.message,
              icon: '/orb-icon.png',
              tag: `orb-alert-${tokenAddress}`,
              requireInteraction: latest.severity === 'critical'
            });
          }

          setRecentAlerts(result.alerts);
        }
      } catch (error) {
        console.error('Error polling alerts:', error);
      }
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [alertsEnabled, tokenAddress]);

  const checkAlertStatus = async () => {
    try {
      const result = await getAlertStatus(tokenAddress);
      if (result.success) {
        setAlertsEnabled(result.alerts_enabled);
      }
    } catch (error) {
      console.error('Error checking alert status:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
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

        // Enable alerts
        const result = await enableTokenAlerts(tokenAddress);
        if (result.success) {
          setAlertsEnabled(true);
        }
      } else {
        // Disable alerts
        const result = await disableTokenAlerts(tokenAddress);
        if (result.success) {
          setAlertsEnabled(false);
        }
      }
    } catch (error) {
      console.error('Error toggling alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
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

      {alertsEnabled && notificationPermission !== 'granted' && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-600/20 border border-yellow-500 text-yellow-400 text-xs p-2 rounded">
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
