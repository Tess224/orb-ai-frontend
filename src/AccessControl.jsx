import { useState, useEffect } from 'react';
import { Key, X, Info, RefreshCw } from 'lucide-react';

const BACKEND_URL = 'https://orbonsolana.up.railway.app';

/**
 * AccessControl Component
 *
 * Provides a modal popup for users to enter their access code and view their rate limit status.
 * Access codes are validated against the backend - no hardcoded codes in frontend!
 */
export function AccessControl({ children }) {
  const [showModal, setShowModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { limit, used, remaining, resets_at }

  /**
   * Load saved access code from localStorage on mount
   */
  useEffect(() => {
    const savedCode = localStorage.getItem('orb_access_code');
    if (savedCode) {
      setAccessCode(savedCode);
      fetchAccessStatus(savedCode);
    } else {
      // Default to 'anonymous' if no code is set
      setAccessCode('anonymous');
      fetchAccessStatus('anonymous');
    }
  }, []);

  /**
   * Fetch access code status from backend
   */
  const fetchAccessStatus = async (code) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/access/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: code })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatus({
            limit: data.limit,
            used: data.used,
            remaining: data.remaining,
            resets_at: data.resets_at,
            masked_code: data.access_code
          });
        }
      } else {
        // If backend fails, show default status
        setStatus({
          limit: 10,
          used: 0,
          remaining: 10,
          resets_at: Date.now() / 1000 + 86400,
          masked_code: '***'
        });
      }
    } catch (error) {
      console.error('Error fetching access status:', error);
      // Show default status on error
      setStatus({
        limit: 10,
        used: 0,
        remaining: 10,
        resets_at: Date.now() / 1000 + 86400,
        masked_code: '***'
      });
    }
  };

  /**
   * Handle submitting a new access code
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const code = inputValue.trim();
    if (!code) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate the code with the backend
      const response = await fetch(`${BACKEND_URL}/api/access/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: code })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Valid code! Save it
          localStorage.setItem('orb_access_code', code);
          setAccessCode(code);
          setStatus({
            limit: data.limit,
            used: data.used,
            remaining: data.remaining,
            resets_at: data.resets_at,
            masked_code: data.access_code
          });
          setShowModal(false);
          setInputValue('');
          setError('');
        } else {
          setError('Invalid access code');
        }
      } else {
        setError('Unable to validate access code');
      }
    } catch (error) {
      console.error('Error validating access code:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove access code (revert to anonymous)
   */
  const handleRemoveCode = () => {
    localStorage.removeItem('orb_access_code');
    setAccessCode('anonymous');
    setInputValue('');
    setShowModal(false);
    fetchAccessStatus('anonymous');
  };

  /**
   * Refresh status
   */
  const handleRefreshStatus = () => {
    fetchAccessStatus(accessCode);
  };

  /**
   * Format reset time
   */
  const formatResetTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  /**
   * Get color for remaining analyses
   */
  const getRemainingColor = () => {
    if (!status) return 'text-green-400';
    const percentage = (status.remaining / status.limit) * 100;
    if (percentage > 50) return 'text-green-400';
    if (percentage > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div>
      {/* Status bar at the top */}
      <div className="bg-black/90 border-b border-green-400/30 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-xs">
            <span className="text-green-400/60">Access Code:</span>{' '}
            <span className="text-green-400 font-bold font-mono">
              {status?.masked_code || '***'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-xs">
                <span className="text-green-400/60">Usage:</span>{' '}
                <span className={`font-bold ${getRemainingColor()}`}>
                  {status.used}/{status.limit}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-green-400/60">Remaining:</span>{' '}
                <span className={`font-bold ${getRemainingColor()}`}>
                  {status.remaining}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshStatus}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition px-2 py-1 border border-cyan-400/30 rounded flex items-center gap-1"
            title="Refresh status"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-green-400 hover:text-green-300 transition px-3 py-1 border border-green-400/30 rounded flex items-center gap-1"
          >
            <Key className="w-3 h-3" />
            CHANGE CODE
          </button>
        </div>
      </div>

      {/* Main app content */}
      {children}

      {/* Access Code Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-black border-2 border-green-400 rounded-lg p-6 relative">
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-green-400/60 hover:text-green-400 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal header */}
            <div className="flex items-center gap-3 mb-6">
              <Key className="w-8 h-8 text-purple-400" />
              <div>
                <h2 className="text-xl font-bold text-green-400">
                  Access Code
                </h2>
                <p className="text-xs text-green-400/60">
                  Enter your code to increase your analysis limit
                </p>
              </div>
            </div>

            {/* Current status */}
            {status && (
              <div className="bg-green-400/10 border border-green-400/30 rounded p-4 mb-6">
                <div className="text-sm mb-2">
                  <span className="text-green-400/60">Current Code:</span>{' '}
                  <span className="text-green-400 font-bold font-mono">
                    {status.masked_code}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <span className="text-green-400/60">Daily Limit:</span>{' '}
                  <span className="text-yellow-400 font-bold">
                    {status.limit} analyses
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <span className="text-green-400/60">Used Today:</span>{' '}
                  <span className={`font-bold ${getRemainingColor()}`}>
                    {status.used}/{status.limit}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-green-400/60">Resets:</span>{' '}
                  <span className="text-cyan-400 text-xs">
                    {formatResetTime(status.resets_at)}
                  </span>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="bg-cyan-400/10 border border-cyan-400/30 rounded p-3 mb-6 flex gap-2">
              <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-cyan-400">
                <p className="mb-2">
                  <strong>Default:</strong> 10 analyses/day (anonymous)
                </p>
                <p>
                  <strong>Admin Code:</strong> Up to 1000 analyses/day
                </p>
              </div>
            </div>

            {/* Access code input form */}
            <form onSubmit={handleSubmit}>
              <label className="block text-sm text-green-400 mb-2 font-bold">
                Enter New Access Code
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="YOUR-ACCESS-CODE"
                className="w-full bg-black border-2 border-green-400/30 rounded px-4 py-3 text-green-400 placeholder-green-400/30 focus:border-green-400 focus:outline-none mb-4 font-mono uppercase"
                disabled={loading}
              />

              {/* Error message */}
              {error && (
                <div className="mb-4 text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded p-2">
                  ⚠️ {error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-400 text-black font-bold py-3 rounded hover:bg-green-300 transition-all shadow-[0_0_15px_rgba(74,222,128,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'VALIDATING...' : 'UPDATE CODE'}
                </button>
                {accessCode !== 'anonymous' && (
                  <button
                    type="button"
                    onClick={handleRemoveCode}
                    className="px-4 py-3 border-2 border-red-400/30 text-red-400 rounded hover:bg-red-400/10 transition"
                  >
                    REMOVE
                  </button>
                )}
              </div>
            </form>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-green-400/20">
              <p className="text-xs text-green-400/60 text-center">
                Contact the administrator to request an access code
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}