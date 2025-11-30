// ============================================
// ORB COMPLETE APPLICATION
// Combines DexScreener data + Full analysis UI
// ============================================

import { useState, useEffect, useRef } from 'react';
import { 
  Search, TrendingUp, Brain, Wallet, Activity, Zap, AlertCircle, 
  ChevronRight, Sparkles, ExternalLink, RefreshCw, Copy, Check, 
  TrendingDown, Minus 
} from 'lucide-react';
import { 
  fetchTokenInfoByAddress, 
  fetchTokenInfoBySymbol, 
  fetchPumpFunTrends,
  fetchTokenHolders,
  getTokenSupply,
  analyzeWalletViaBackend,
  getPrivacyAnalysis 
} from './api';
import { HashRouter, Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PrivyProvider } from './PrivyProvider';
// ============================================
// CACHE SYSTEM
// ============================================

const cache = new Map();

const getCacheKey = (type, identifier) => `${type}:${identifier}`;

const getCachedData = (key, ttl) => {
  const cached = cache.get(key);
  if (!cached) return null;
  const age = Date.now() - cached.timestamp;
  if (age > ttl) {
    cache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

const CACHE_TTL = {
  TOKEN_INFO: 60 * 1000,
  TOP_HOLDERS: 60 * 1000,
  HOLDER_DATA: 5 * 60 * 1000,
  ANALYZED_WALLETS: 60 * 1000,
};

// ============================================
// TERMINAL COMPONENT
// ============================================

function Terminal() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  
  const [searchInput, setSearchInput] = useState(tokenFromUrl || '');
  const [loading, setLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState(null);
  const [walletAnalysis, setWalletAnalysis] = useState([]);
  const [coinScore, setCoinScore] = useState(null);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [countdown, setCountdown] = useState(180);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  const abortControllerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    if (tokenFromUrl) analyzeToken();
    return () => stopScanning();
  }, [tokenFromUrl]);

  const stopScanning = () => {
    setIsScanning(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const analyzeToken = async (forceRefresh = false) => {
    if (!searchInput.trim()) return;

    stopScanning();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError('');
    setIsScanning(true);
    setCountdown(180);
    setAnalysisProgress({ current: 0, total: 0 });

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    try {
      if (signal.aborted) return;

      // Step 1: Fetch token info
      const tokenIdentifier = searchInput.trim();
      let tokenInfo;
      const tokenCacheKey = getCacheKey('token_info', tokenIdentifier);
      const cachedTokenInfo = !forceRefresh ? getCachedData(tokenCacheKey, CACHE_TTL.TOKEN_INFO) : null;

      if (cachedTokenInfo) {
        tokenInfo = cachedTokenInfo;
      } else {
        if (tokenIdentifier.length > 20) {
          tokenInfo = await fetchTokenInfoByAddress(tokenIdentifier);
        } else {
          tokenInfo = await fetchTokenInfoBySymbol(tokenIdentifier);
        }

        if (!tokenInfo) {
          setError('Token not found');
          setLoading(false);
          setIsScanning(false);
          return;
        }
        setCachedData(tokenCacheKey, tokenInfo);
      }

      if (signal.aborted) return;
      setCurrentToken(tokenInfo);

      // Step 2: Handle Privacy Mode
      if (privacyMode) {
        const privacyAnalysisResult = await getPrivacyAnalysis(tokenInfo.contractAddress);
        if (signal.aborted) return;

        if (privacyAnalysisResult.error) {
          setError(privacyAnalysisResult.error);
          setLoading(false);
          setIsScanning(false);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return;
        }

        setCoinScore({
          overall: privacyAnalysisResult.overall || privacyAnalysisResult.scores?.pre_pump_score || 0,
          smartMoney: '0.0',
          avgWinRate: '0.0',
          rating: privacyAnalysisResult.rating || 'UNKNOWN',
          privacyMetrics: privacyAnalysisResult
        });
        setWalletAnalysis([]);
        setLoading(false);
        setIsScanning(false);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        return;
      }

      // Step 3: Wallet Analysis Mode
      const holdersCacheKey = getCacheKey('holders', tokenInfo.contractAddress);
      let cachedHolders = !forceRefresh ? getCachedData(holdersCacheKey, CACHE_TTL.TOP_HOLDERS) : null;
      let analyzedHolders;

      if (cachedHolders) {
        analyzedHolders = cachedHolders;
      } else {
        if (signal.aborted) return;

        try {
          const holderData = await fetchTokenHolders(tokenInfo.contractAddress);
          const totalSupply = await getTokenSupply(tokenInfo.contractAddress);

          if (!holderData || holderData.length === 0) {
            setError('Failed to retrieve token holders');
            setLoading(false);
            setIsScanning(false);
            return;
          }

          const walletsToAnalyze = holderData.slice(0, 30);
          setAnalysisProgress({ current: 0, total: walletsToAnalyze.length });

          const liquidityPools = [];
          const normalWallets = [];
          
          walletsToAnalyze.forEach(holder => {
            const holdingPercent = parseFloat((holder.amount / totalSupply * 100).toFixed(2));
            if (holdingPercent >= 25) {
              liquidityPools.push({
                address: holder.address,
                iq: 0,
                winRate: '0.0',
                trades: 0,
                portfolio: 0,
                pattern: 'LIQUIDITY POOL',
                holdScore: 0,
                holdingAmount: holder.amount.toFixed(0),
                holdingPercent: holdingPercent.toFixed(2),
                firstBuyTime: null
              });
            } else {
              normalWallets.push(holder);
            }
          });

          analyzedHolders = [...liquidityPools];
          
          for (let i = 0; i < normalWallets.length; i++) {
            if (signal.aborted) throw new Error('Scanning stopped');
            
            const holder = normalWallets[i];
            const holdingPercent = (holder.amount / totalSupply * 100).toFixed(2);
            
            setAnalysisProgress({ current: i + 1, total: normalWallets.length });
            
            try {
              const walletData = await analyzeWalletViaBackend(
                holder.address,
                tokenInfo.contractAddress,
                parseFloat(holdingPercent)
              );
              
              analyzedHolders.push({
                address: holder.address,
                iq: walletData.iq || 50,
                winRate: walletData.winRate || '0.0',
                trades: walletData.trades || 0,
                tradesScore: walletData.tradesScore || 0,
                portfolio: walletData.portfolio || 0,
                pattern: walletData.pattern || 'Unknown',
                holdScore: walletData.holdScore || 0,
                holdingAmount: holder.amount.toFixed(0),
                holdingPercent,
                firstBuyTime: walletData.firstBuyTime || null
              });
            } catch (error) {
              console.error(`Error analyzing wallet ${holder.address}:`, error);
              analyzedHolders.push({
                address: holder.address,
                iq: 50,
                winRate: '0.0',
                trades: 0,
                tradesScore: 0,
                portfolio: 0,
                pattern: 'ERROR',
                holdScore: 0,
                holdingAmount: holder.amount.toFixed(0),
                holdingPercent
              });
            }
          }

          analyzedHolders.sort((a, b) => b.iq - a.iq);
          setCachedData(holdersCacheKey, analyzedHolders);

        } catch (error) {
          console.error('Error fetching holders:', error);
          analyzedHolders = [];
        }
      }

      if (signal.aborted) return;
      setWalletAnalysis(analyzedHolders);

      // Calculate coin score
      if (analyzedHolders.length > 0) {
        let weightedIQSum = 0;
        let totalHoldingPercent = 0;
        
        analyzedHolders.forEach(w => {
          const holdingPct = parseFloat(w.holdingPercent) || 0;
          const walletIQ = parseFloat(w.iq) || 0;
          weightedIQSum += walletIQ * holdingPct;
          totalHoldingPercent += holdingPct;
        });

        const weightedAvgIQ = totalHoldingPercent > 0 ? weightedIQSum / totalHoldingPercent : 0;
        const walletIQComponent = weightedAvgIQ * 0.5;

        const smartMoneyCount = analyzedHolders.filter(w => w.iq >= 75).length;
        const smartMoneyPercent = (smartMoneyCount / analyzedHolders.length) * 100;
        const smartMoneyComponent = smartMoneyPercent * 0.3;

        const majorHolders = analyzedHolders.filter(w => 
          parseFloat(w.holdingPercent) > 0.5 && w.holdScore > 17
        );
        const majorHoldersComponent = Math.min(majorHolders.length, 20);

        const coinIQ = Math.floor(walletIQComponent + smartMoneyComponent + majorHoldersComponent);
        const avgWinRate = analyzedHolders.reduce((sum, w) => sum + (parseFloat(w.winRate) || 0), 0) / analyzedHolders.length;

        setCoinScore({
          overall: coinIQ,
          smartMoney: smartMoneyPercent.toFixed(1),
          avgWinRate: avgWinRate.toFixed(1),
          rating: coinIQ >= 80 ? 'ELITE' : coinIQ >= 60 ? 'SMART' : coinIQ >= 40 ? 'AVERAGE' : 'DEGEN'
        });
      } else {
        setCoinScore({
          overall: 0,
          smartMoney: '0.0',
          avgWinRate: '0.0',
          rating: 'UNKNOWN'
        });
      }

    } catch (err) {
      if (err.message === 'Scanning stopped') {
        setError('Scanning stopped by user');
      } else {
        setError(err.message || 'Error analyzing token');
        console.error(err);
      }
    }
    
    setLoading(false);
    setIsScanning(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  // Helper functions
  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIQColor = (iq) => {
    if (iq >= 100) return 'text-cyan-400';
    if (iq >= 80) return 'text-green-400';
    if (iq >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreColor = (score) => {
    if (score >= 100) return 'from-purple-500 to-pink-500';
    if (score >= 80) return 'from-cyan-500 to-blue-500';
    if (score >= 60) return 'from-green-500 to-emerald-500';
    return 'from-yellow-500 to-orange-500';
  };

  const copyToClipboard = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStateIcon = (state) => {
    if (state === 'PRE_PUMP' || state === 'PUMP') return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (state === 'PRE_DUMP' || state === 'DUMP') return <TrendingDown className="w-5 h-5 text-red-400" />;
    if (state === 'HOLDING') return <Activity className="w-5 h-5 text-cyan-400" />;
    if (state === 'UNCERTAIN') return <AlertCircle className="w-5 h-5 text-orange-400" />;
    return <Minus className="w-5 h-5 text-yellow-400" />;
  };

  const getStateColor = (state) => {
    if (state === 'PRE_PUMP' || state === 'PUMP') return 'text-green-400 bg-green-400/10 border-green-400';
    if (state === 'PRE_DUMP' || state === 'DUMP') return 'text-red-400 bg-red-400/10 border-red-400';
    if (state === 'HOLDING') return 'text-cyan-400 bg-cyan-400/10 border-cyan-400';
    if (state === 'UNCERTAIN') return 'text-orange-400 bg-orange-400/10 border-orange-400';
    return 'text-yellow-400 bg-yellow-400/10 border-yellow-400';
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-2 border-green-400 rounded-lg p-4 mb-6 bg-black/50 backdrop-blur">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                  ORB
                </h1>
                <p className="text-xs text-green-400/60">Onchain Research & Behavior Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1 border border-purple-400/30 rounded bg-black/50">
                <span className={`text-xs font-bold ${privacyMode ? 'text-purple-400' : 'text-green-400/60'}`}>
                  PRIVACY MODE
                </span>
                <button
                  onClick={() => setPrivacyMode(!privacyMode)}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    privacyMode ? 'bg-purple-400' : 'bg-green-400/30'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-black transition-transform ${
                      privacyMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <PrivyWallet />
              
              <div className="flex gap-2 border border-green-400/30 rounded p-1">
                <Link to="/" className="px-3 py-1 bg-green-400 text-black text-sm font-bold rounded">
                  TERMINAL
                </Link>
                <Link to="/marketplace" className="px-3 py-1 text-green-400 text-sm font-bold rounded hover:bg-green-400/10">
                  MARKETPLACE
                </Link>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400/50" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && analyzeToken()}
                placeholder="Enter token address or symbol..."
                className="w-full bg-black border-2 border-green-400/30 rounded px-10 py-3 text-green-400 placeholder-green-400/30 focus:border-green-400 focus:outline-none"
              />
            </div>
            {!isScanning ? (
              <button
                onClick={() => analyzeToken()}
                disabled={loading}
                className="px-6 py-3 bg-green-400 text-black font-bold rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'SCANNING...' : 'ANALYZE'}
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="px-6 py-3 bg-red-400 text-black font-bold rounded hover:bg-red-300 transition-all flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                STOP
              </button>
            )}
          </div>
          
          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {isScanning && !privacyMode && analysisProgress.total > 0 && (
            <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>
                Analyzing wallets via backend: {analysisProgress.current} / {analysisProgress.total}
              </span>
            </div>
          )}
          
          {privacyMode && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-400/10 border border-purple-400/30 rounded">
              <AlertCircle className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400">
                Privacy Mode: Analyzing using orderbook microstructure (no wallet tracking)
              </span>
            </div>
          )}
        </div>

        {/* Token Info & Scores */}
        {currentToken && coinScore && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Token Info Card */}
            <div className="border-2 border-green-400/30 rounded-lg p-4 bg-black/50">
              <div className="flex items-start gap-3">
                <img
                  src={currentToken.image}
                  alt={currentToken.symbol}
                  className="w-12 h-12 rounded-full border-2 border-green-400"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/50'; }}
                />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-400">{currentToken.symbol}</h3>
                  <p className="text-xs text-green-400/60 truncate">{currentToken.contractAddress}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-400/60">Price:</span>
                      <span className="text-cyan-400">${currentToken.price?.toFixed(8) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400/60">MCap:</span>
                      <span className="text-cyan-400">${(currentToken.marketcap || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coin Score Card */}
            <div className="border-2 border-purple-400 rounded-lg p-4 bg-black/50 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${getScoreColor(coinScore.overall)} opacity-10`}></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-green-400/60">
                    {privacyMode ? 'ACTION' : 'COIN INTELLIGENCE'}
                  </span>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {privacyMode ? coinScore.privacyMetrics?.action || 'ANALYZING' : `${coinScore.overall} IQ`}
                </div>
                <div className="mt-2 px-2 py-1 bg-purple-400/20 border border-purple-400/50 rounded inline-block">
                  <span className="text-xs font-bold text-purple-400">{coinScore.rating}</span>
                </div>
              </div>
            </div>

            {/* Metrics Card */}
            <div className="border-2 border-cyan-400/30 rounded-lg p-4 bg-black/50 space-y-3">
              {privacyMode && coinScore.privacyMetrics ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStateIcon(coinScore.privacyMetrics.state)}
                      <span className="text-xs text-green-400/60">State</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${getStateColor(coinScore.privacyMetrics.state)}`}>
                      {coinScore.privacyMetrics.state || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-green-400/60">Confidence</span>
                    </div>
                    <span className="text-purple-400 font-bold">
                      {coinScore.privacyMetrics.confidence || 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-green-400/60">Timeframe</span>
                    </div>
                    <span className="text-cyan-400 font-bold text-xs">
                      {coinScore.privacyMetrics.timeframe || 'N/A'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-green-400/60">Smart Money</span>
                    </div>
                    <span className="text-cyan-400 font-bold">{coinScore.smartMoney}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400/60">Avg Win Rate</span>
                    </div>
                    <span className="text-green-400 font-bold">{coinScore.avgWinRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-green-400/60">Holders</span>
                    </div>
                    <span className="text-purple-400 font-bold">{walletAnalysis.length}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Privacy Mode Detailed Analysis */}
        {privacyMode && currentToken && coinScore && coinScore.privacyMetrics && (
          <div className="border-2 border-purple-400/30 rounded-lg bg-black/50 overflow-hidden mb-6">
            <div className="p-4 border-b-2 border-purple-400/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-purple-400">
                    ORDERBOOK MICROSTRUCTURE ANALYSIS
                  </h2>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Main Action */}
              {coinScore.privacyMetrics.action && (
                <div className={`border-2 rounded-lg p-6 ${
                  coinScore.privacyMetrics.state === 'PRE_PUMP' || coinScore.privacyMetrics.state === 'PUMP'
                    ? 'border-green-400 bg-green-400/10'
                    : coinScore.privacyMetrics.state === 'PRE_DUMP' || coinScore.privacyMetrics.state === 'DUMP'
                    ? 'border-red-400 bg-red-400/10'
                    : coinScore.privacyMetrics.state === 'HOLDING'
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-yellow-400 bg-yellow-400/10'
                }`}>
                  <div className="text-xs font-bold text-green-400/60 mb-2">RECOMMENDATION</div>
                  <div className={`text-2xl font-bold ${
                    coinScore.privacyMetrics.state === 'PRE_PUMP' || coinScore.privacyMetrics.state === 'PUMP'
                      ? 'text-green-400'
                      : coinScore.privacyMetrics.state === 'PRE_DUMP' || coinScore.privacyMetrics.state === 'DUMP'
                      ? 'text-red-400'
                      : coinScore.privacyMetrics.state === 'HOLDING'
                      ? 'text-cyan-400'
                      : 'text-yellow-400'
                  }`}>
                    {coinScore.privacyMetrics.action}
                  </div>
                </div>
              )}

              {/* Velocity (NEW from friend's version) */}
              {coinScore.privacyMetrics.velocity && (
                <div className="border-2 border-cyan-400/30 rounded-lg p-4 bg-cyan-400/5">
                  <div className="text-xs font-bold text-green-400/60 mb-3">VELOCITY ANALYSIS</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-cyan-400">
                        {coinScore.privacyMetrics.velocity.ratio_percent?.toFixed(1) || '0.0'}%
                      </div>
                      <div className="text-xs text-green-400/60 mt-1">Volume / Liquidity Ratio</div>
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${
                        coinScore.privacyMetrics.velocity.status === 'HEALTHY' ? 'text-green-400' :
                        coinScore.privacyMetrics.velocity.status === 'ZOMBIE' ? 'text-red-400' :
                        coinScore.privacyMetrics.velocity.status === 'FRENZY' ? 'text-orange-400' :
                        'text-yellow-400'
                      }`}>
                        {coinScore.privacyMetrics.velocity.status || 'UNKNOWN'}
                      </div>
                      <div className="text-xs text-green-400/60 mt-1">
                        {coinScore.privacyMetrics.velocity.description || 'No velocity data'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-cyan-400">
                    Health Score: {coinScore.privacyMetrics.velocity.health_score || 0}/100
                  </div>
                </div>
              )}

              {/* Signals */}
              {coinScore.privacyMetrics.signals && coinScore.privacyMetrics.signals.length > 0 && (
                <div className="border-2 border-yellow-400/30 rounded-lg p-4 bg-yellow-400/5">
                  <div className="text-xs font-bold text-green-400/60 mb-3">
                    SIGNALS DETECTED
                  </div>
                  <div className="space-y-2">
                    {coinScore.privacyMetrics.signals.map((signal, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span className="text-yellow-400">{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slippage Data */}
              {coinScore.privacyMetrics.slippage_data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Buy Slippage */}
                  <div className="border-2 border-green-400/30 rounded-lg p-4 bg-green-400/5">
                    <div className="text-xs font-bold text-green-400/60 mb-3">
                      BUY SLIPPAGE
                    </div>
                    {coinScore.privacyMetrics.slippage_data.buy_slippage && 
                     coinScore.privacyMetrics.slippage_data.buy_slippage.length > 0 ? (
                      <div className="space-y-2">
                        {coinScore.privacyMetrics.slippage_data.buy_slippage.map((slip, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs border-b border-green-400/10 pb-2">
                            <span className="text-green-400/60">
                              ${slip.size_usd || slip.probeSize} trade:
                            </span>
                            <span className={`font-bold px-2 py-0.5 rounded ${
                              slip.slippage_pct < 1 ? 'bg-green-400/20 text-green-400' :
                              slip.slippage_pct < 3 ? 'bg-yellow-400/20 text-yellow-400' :
                              slip.slippage_pct < 7 ? 'bg-orange-400/20 text-orange-400' :
                              'bg-red-400/20 text-red-400'
                            }`}>
                              +{slip.slippage_pct?.toFixed(2) || '0.00'}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-green-400/60">No buy slippage data</div>
                    )}
                  </div>

                  {/* Sell Slippage */}
                  <div className="border-2 border-red-400/30 rounded-lg p-4 bg-red-400/5">
                    <div className="text-xs font-bold text-green-400/60 mb-3">
                      SELL SLIPPAGE
                    </div>
                    {coinScore.privacyMetrics.slippage_data.sell_slippage && 
                     coinScore.privacyMetrics.slippage_data.sell_slippage.length > 0 ? (
                      <div className="space-y-2">
                        {coinScore.privacyMetrics.slippage_data.sell_slippage.map((slip, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs border-b border-red-400/10 pb-2">
                            <span className="text-red-400/60">
                              ${slip.size_usd || slip.probeSize} trade:
                            </span>
                            <span className={`font-bold px-2 py-0.5 rounded ${
                              slip.slippage_pct < 1 ? 'bg-green-400/20 text-green-400' :
                              slip.slippage_pct < 3 ? 'bg-yellow-400/20 text-yellow-400' :
                              slip.slippage_pct < 7 ? 'bg-orange-400/20 text-orange-400' :
                              'bg-red-400/20 text-red-400'
                            }`}>
                              -{slip.slippage_pct?.toFixed(2) || '0.00'}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-red-400/60">No sell slippage data</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wallet Analysis Table */}
        {walletAnalysis.length > 0 && !privacyMode && (
          <div className="border-2 border-green-400/30 rounded-lg bg-black/50 overflow-hidden">
            <div className="p-4 border-b-2 border-green-400/30">
              <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                TOP HOLDER INTELLIGENCE ANALYSIS
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-green-400/30 bg-green-400/5">
                    <th className="text-left p-3 text-xs text-green-400/60 font-bold">RANK</th>
                    <th className="text-left p-3 text-xs text-green-400/60 font-bold">WALLET</th>
                    <th className="text-right p-3 text-xs text-green-400/60 font-bold">IQ SCORE</th>
                    <th className="text-left p-3 text-xs text-green-400/60 font-bold">PATTERN</th>
                    <th className="text-right p-3 text-xs text-green-400/60 font-bold">WIN RATE</th>
                    <th className="text-right p-3 text-xs text-green-400/60 font-bold">TRADES</th>
                    <th className="text-right p-3 text-xs text-green-400/60 font-bold">HOLDING</th>
                  </tr>
                </thead>
                <tbody>
                  {walletAnalysis.map((wallet, idx) => (
                    <tr key={idx} className="border-b border-green-400/10 hover:bg-green-400/5 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400/60 text-sm">#{idx + 1}</span>
                          {idx < 3 && <ChevronRight className="w-4 h-4 text-yellow-400" />}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 text-sm font-mono">
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-4)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(wallet.address)}
                            className="p-1 hover:bg-green-400/10 rounded transition-all"
                          >
                            {copiedAddress === wallet.address ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-green-400/50 hover:text-green-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`text-lg font-bold ${getIQColor(wallet.iq)}`}>
                          {wallet.iq}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-1 bg-green-400/10 border border-green-400/30 rounded text-green-400">
                          {wallet.pattern}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-bold ${
                          parseFloat(wallet.winRate) > 70 ? 'text-green-400' : 
                          parseFloat(wallet.winRate) > 50 ? 'text-yellow-400' : 
                          'text-red-400'
                        }`}>
                          {wallet.winRate}%
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-green-400">{wallet.trades}</span>
                      </td>
                      <td className="p-3 text-right">
                        <div>
                          <div className="text-purple-400 font-bold">
                            {parseFloat(wallet.holdingAmount).toLocaleString()}
                          </div>
                          <div className="text-xs text-green-400/60">{wallet.holdingPercent}%</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && walletAnalysis.length === 0 && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/5 to-cyan-400/5 animate-pulse"></div>
            <div className="relative">
              <div className="flex items-center justify-center mb-6">
                <Brain className="w-20 h-20 text-green-400 animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-green-400 mb-2">
                {privacyMode ? 'ANALYZING ORDERBOOK...' : 'ANALYZING WALLETS...'}
              </h3>
              <p className="text-green-400/60 text-sm mb-6">
                {privacyMode 
                  ? 'Probing Jupiter for orderbook reconstruction' 
                  : 'Scanning blockchain for intelligence data'}
              </p>
              <div className="inline-flex items-center gap-3 px-6 py-3 border-2 border-green-400/30 rounded-lg bg-black/50">
                <Activity className="w-5 h-5 text-cyan-400 animate-spin" />
                <div>
                  <div className="text-xs text-green-400/60 mb-1">Estimated Time</div>
                  <div className="text-3xl font-bold font-mono text-cyan-400">
                    {formatCountdown(countdown)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentToken && !loading && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50">
            <Brain className="w-16 h-16 mx-auto mb-4 text-green-400/30" />
            <h3 className="text-xl font-bold text-green-400/60 mb-2">TERMINAL READY</h3>
            <p className="text-green-400/40 text-sm">
              Enter a Solana token address to analyze
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="border border-green-400/20 rounded p-4">
                <Brain className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <div className="text-xs text-green-400/60">IQ Scoring</div>
              </div>
              <div className="border border-green-400/20 rounded p-4">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <div className="text-xs text-green-400/60">Win Rate Analysis</div>
              </div>
              <div className="border border-green-400/20 rounded p-4">
                <Zap className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                <div className="text-xs text-green-400/60">Smart Money Detection</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MARKETPLACE COMPONENT
// ============================================

function Marketplace() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrendingTokens();
    const interval = setInterval(loadTrendingTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTrendingTokens = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    
    try {
      const trendingCacheKey = getCacheKey('trending', 'dexscreener');
      const cachedTrending = !forceRefresh ? getCachedData(trendingCacheKey, 30000) : null;
      
      if (cachedTrending) {
        setTokens(cachedTrending);
        setError('');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const trending = await fetchPumpFunTrends();
      const sortedTokens = (trending || []).sort((a, b) => {
        if (sortBy === 'time') {
          return (b.created_timestamp || 0) - (a.created_timestamp || 0);
        } else {
          return (b.market_cap || 0) - (a.market_cap || 0);
        }
      });

      setTokens(sortedTokens.slice(0, 50));
      setCachedData(trendingCacheKey, sortedTokens.slice(0, 50));
      setError('');
    } catch (err) {
      setError('Failed to load tokens');
      console.error('Error loading trending tokens:', err);
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const handleAnalyze = (tokenAddress) => {
    navigate(`/?token=${tokenAddress}`);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortBy === 'time') {
      return (b.created_timestamp || 0) - (a.created_timestamp || 0);
    } else if (sortBy === 'mcap') {
      return (b.market_cap || 0) - (a.market_cap || 0);
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-2 border-green-400 rounded-lg p-4 mb-6 bg-black/50 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-green-400 bg-clip-text text-transparent">
                  ORB MARKETPLACE
                </h1>
                <p className="text-xs text-green-400/60">Trending Solana Tokens</p>
              </div>
            </div>
            <div className="flex gap-2 border border-green-400/30 rounded p-1">
              <Link to="/" className="px-3 py-1 text-green-400 text-sm font-bold rounded hover:bg-green-400/10">
                TERMINAL
              </Link>
              <Link to="/marketplace" className="px-3 py-1 bg-green-400 text-black text-sm font-bold rounded">
                MARKETPLACE
              </Link>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-sm text-green-400/60">
                Live Feed • {tokens.length} tokens
              </span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-black border border-green-400/30 rounded px-3 py-1 text-sm text-green-400 focus:border-green-400 focus:outline-none cursor-pointer"
              >
                <option value="time">Sort by: Creation Time</option>
                <option value="mcap">Sort by: Market Cap</option>
              </select>
              
              <button
                onClick={() => loadTrendingTokens(true)}
                disabled={refreshing}
                className="px-3 py-1 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400 hover:bg-green-400/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="border-2 border-orange-400/30 rounded-lg p-4 mb-6 bg-orange-400/5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400">{error}</span>
          </div>
        )}

        {/* Token Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTokens.map((token) => (
            <div
              key={token.mint}
              className="border-2 border-green-400/30 rounded-lg p-4 bg-black/50 hover:border-green-400 transition-all cursor-pointer"
              onClick={() => handleAnalyze(token.mint)}
            >
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={token.image_uri}
                  alt={token.symbol}
                  className="w-12 h-12 rounded-full border-2 border-green-400"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/50'; }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-green-400 truncate">
                    {token.symbol}
                  </h3>
                  <p className="text-xs text-green-400/60 truncate">{token.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-cyan-400 font-mono">
                      {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-green-400/60 mb-3 line-clamp-2 min-h-[2.5rem]">
                {token.description || 'No description available'}
              </p>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-green-400/60">Created:</span>
                  <span className="text-yellow-400">
                    {token.created_timestamp ? formatTime(token.created_timestamp) : 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-green-400/20">
                <button
                  onClick={() => handleAnalyze(token.mint)}
                  className="flex-1 px-3 py-2 bg-green-400 text-black text-sm font-bold rounded hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  ANALYZE
                </button>
                {(token.twitter || token.telegram || token.website) && (
                  <div className="flex gap-1">
                    {token.twitter && (
                      <a
                        href={token.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-2 border border-green-400/30 rounded hover:bg-green-400/10 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4 text-cyan-400" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Loading State */}
        {loading && tokens.length === 0 && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50">
            <div className="flex items-center justify-center mb-4">
              <RefreshCw className="w-16 h-16 text-green-400 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-green-400/60 mb-2">LOADING TOKENS...</h3>
            <p className="text-green-400/40 text-sm">
              Fetching trending tokens from DexScreener
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && tokens.length === 0 && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-green-400/30" />
            <h3 className="text-xl font-bold text-green-400/60 mb-2">NO TOKENS FOUND</h3>
            <p className="text-green-400/40 text-sm">
              Waiting for new token data...
            </p>
            <button
              onClick={() => loadTrendingTokens(true)}
              className="mt-4 px-4 py-2 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400 hover:bg-green-400/20 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

function App() {
  return (
    <PrivyProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Terminal />} />
          <Route path="/marketplace" element={<Marketplace />} />
        </Routes>
      </HashRouter>
    </PrivyProvider>
  );
}

export default App;
