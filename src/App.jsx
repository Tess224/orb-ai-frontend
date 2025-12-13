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
  getPrivacyAnalysis,
  getFusedSignal,
  getBatchFusedSignals,
  getFusedSignalExplanation
} from './api';
import { HashRouter, Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AccessControl } from './AccessControl';
import { SimpleWallet } from './SimpleWallet';
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
  // State for fusion signal (privacy mode enhanced analysis)
  const [fusedSignal, setFusedSignal] = useState(null);
  const [showMetricsDetail, setShowMetricsDetail] = useState(false);
  const [showSlippageDetail, setShowSlippageDetail] = useState(false);

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

      // Step 2: Handle Privacy Mode with Fusion Signal
      if (privacyMode) {
        try {
          // Fetch the fused signal which combines real-time metrics + slippage analysis
          const fusionResult = await getFusedSignal(tokenInfo.contractAddress);
    
          if (signal.aborted) return;
    
          if (!fusionResult.success) {
            setError('Failed to generate fusion signal');
            setLoading(false);
            setIsScanning(false);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return;
          }
    
          // Store the complete fusion signal
          setFusedSignal(fusionResult.signal);
    
    // Also maintain the old coinScore format for the header cards
    // This lets us keep the existing token info display working
          setCoinScore({
            overall: Math.round(fusionResult.signal.confidence * 100),
            smartMoney: '0.0',
            avgWinRate: '0.0',
            rating: fusionResult.signal.direction.toUpperCase().replace('_', ' '),
            privacyMetrics: null // Clear old privacy metrics since we're using fusion now
          });
    
          // Privacy mode doesn't analyze individual wallets
          setWalletAnalysis([]);
    
          setLoading(false);
          setIsScanning(false);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return;
    
        } catch (fusionError) {
          console.error('Fusion signal error:', fusionError);
          setError('Failed to analyze token in privacy mode');
          setLoading(false);
          setIsScanning(false);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return;
        }
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
                  {privacyMode ? 'FUSION ANALYSIS' : 'WALLET ANALYSIS'}
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

              <SimpleWallet />
              
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

        {/* Privacy Mode - Fusion Signal Analysis */}
        {privacyMode && fusedSignal && currentToken && (
          <div className="border-2 border-purple-400/30 rounded-lg bg-black/50 overflow-hidden mb-6">
    
            {/* Header */}
            <div className="p-4 border-b-2 border-purple-400/30 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Brain className="w-6 h-6 text-purple-400" />
                  <div>
                    <h2 className="text-lg font-bold text-purple-400">FUSED SIGNAL ANALYSIS</h2>
                    <p className="text-xs text-green-400/60">Real-time Metrics + Liquidity Structure</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg border-2 ${
                  fusedSignal.direction === 'strong_bullish' ? 'border-green-400 bg-green-400/20' :
                  fusedSignal.direction === 'bullish' ? 'border-green-400/60 bg-green-400/10' :
                  fusedSignal.direction === 'neutral' ? 'border-yellow-400 bg-yellow-400/10' :
                  fusedSignal.direction === 'bearish' ? 'border-red-400/60 bg-red-400/10' :
                  fusedSignal.direction === 'strong_bearish' ? 'border-red-400 bg-red-400/20' :
                  'border-red-600 bg-red-600/30'
                }`}>
                  <span className={`text-sm font-bold ${
                    fusedSignal.direction === 'strong_bullish' ? 'text-green-400' :
                    fusedSignal.direction === 'bullish' ? 'text-green-300' :
                    fusedSignal.direction === 'neutral' ? 'text-yellow-400' :
                    fusedSignal.direction === 'bearish' ? 'text-red-300' :
                    fusedSignal.direction === 'strong_bearish' ? 'text-red-400' :
                    'text-red-600'
                  }`}>
                    {fusedSignal.direction.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
      
              {/* Main Action and Confidence Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
                {/* Action Recommendation Card */}
                <div className={`border-2 rounded-lg p-6 ${
                  fusedSignal.action_code === 'BUY' ? 'border-green-400 bg-green-400/10' :
                  fusedSignal.action_code === 'SELL' ? 'border-red-400 bg-red-400/10' :
                  fusedSignal.action_code === 'EXIT' ? 'border-red-600 bg-red-600/20' :
                  fusedSignal.action_code === 'AVOID' ? 'border-orange-400 bg-orange-400/10' :
                  'border-cyan-400 bg-cyan-400/10'
                }`}>
                  <div className="text-xs font-bold text-green-400/60 mb-2">RECOMMENDATION</div>
                  <div className={`text-xl font-bold mb-3 ${
                    fusedSignal.action_code === 'BUY' ? 'text-green-400' :
                    fusedSignal.action_code === 'SELL' ? 'text-red-400' :
                    fusedSignal.action_code === 'EXIT' ? 'text-red-600' :
                    fusedSignal.action_code === 'AVOID' ? 'text-orange-400' :
                    'text-cyan-400'
                  }`}>
                    {fusedSignal.action}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-green-400/60">Action:</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded ${
                      fusedSignal.action_code === 'BUY' ? 'bg-green-400/20 text-green-400' :
                      fusedSignal.action_code === 'SELL' ? 'bg-red-400/20 text-red-400' :
                      fusedSignal.action_code === 'EXIT' ? 'bg-red-600/20 text-red-600' :
                      fusedSignal.action_code === 'AVOID' ? 'bg-orange-400/20 text-orange-400' :
                      'bg-cyan-400/20 text-cyan-400'
                    }`}>
                      {fusedSignal.action_code}
                    </span>
                    <span className="text-xs text-green-400/60 ml-auto">Urgency: {fusedSignal.urgency.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Confidence and Agreement Card */}
                <div className="border-2 border-purple-400/30 rounded-lg p-6 bg-purple-400/5">
                  <div className="text-xs font-bold text-green-400/60 mb-4">SIGNAL STRENGTH</div>
          
                  {/* Confidence Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-green-400/60">Confidence Level</span>
                      <span className="text-2xl font-bold text-purple-400">
                        {(fusedSignal.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-black border border-purple-400/30 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 shadow-lg ${
                          fusedSignal.confidence > 0.7 ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-green-400/50' :
                          fusedSignal.confidence > 0.5 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-yellow-400/50' :
                          'bg-gradient-to-r from-red-400 to-pink-500 shadow-red-400/50'
                        }`}
                        style={{ width: `${fusedSignal.confidence * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-green-400/60 mt-1">
                      {fusedSignal.confidence > 0.7 ? 'High confidence signal' : 
                       fusedSignal.confidence > 0.5 ? 'Medium confidence signal' : 
                       'Low confidence signal'}
                    </div>
                  </div>

                  {/* Systems Agreement Status */}
                  <div className="pt-4 border-t border-purple-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-green-400/60">Systems Agreement</span>
                      <span className={`text-sm font-bold px-2 py-1 rounded ${
                        fusedSignal.systems_agree ? 'bg-green-400/20 text-green-400' : 'bg-orange-400/20 text-orange-400'
                      }`}>
                        {fusedSignal.systems_agree ? '✓ AGREE' : '⚠ DISAGREE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-400/60">Alignment Strength</span>
                      <span className="text-purple-400 font-bold">
                        {(Math.abs(fusedSignal.agreement_strength) * 100).toFixed(0)}%
                        {fusedSignal.agreement_strength < 0 && ' (opposing)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disagreement Warning Banner */}
              {!fusedSignal.systems_agree && fusedSignal.disagreement_reason && (
                <div className="border-2 border-orange-400/30 rounded-lg p-4 bg-orange-400/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-orange-400 mb-2">Why the Systems Disagree</div>
                      <div className="text-sm text-green-400/80 leading-relaxed">{fusedSignal.disagreement_reason}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Assessment Section */}
              {fusedSignal.risk_factors && fusedSignal.risk_factors.length > 0 && (
                <div className={`border-2 rounded-lg p-4 ${
                  fusedSignal.risk_level === 'extreme' ? 'border-red-600 bg-red-600/20' :
                  fusedSignal.risk_level === 'high' ? 'border-red-400 bg-red-400/10' :
                  fusedSignal.risk_level === 'medium' ? 'border-yellow-400 bg-yellow-400/10' :
                  'border-green-400 bg-green-400/10'
                }`}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="text-sm font-bold text-green-400/60">RISK ASSESSMENT</div>
                    <span className={`text-sm font-bold px-3 py-1 rounded ${
                      fusedSignal.risk_level === 'extreme' ? 'bg-red-600/30 text-red-600' :
                      fusedSignal.risk_level === 'high' ? 'bg-red-400/20 text-red-400' :
                      fusedSignal.risk_level === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-green-400/20 text-green-400'
                    }`}>
                      {fusedSignal.risk_level.toUpperCase()} RISK
                    </span>
                  </div>
                  <div className="space-y-2">
                    {fusedSignal.risk_factors.map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-yellow-400 mt-0.5 flex-shrink-0">•</span>
                        <span className="text-green-400/80">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Technical Details */}
              <div className="space-y-3">
        
                {/* Real-Time Metrics Breakdown */}
                {fusedSignal.metrics_signal && (
                  <div className="border-2 border-cyan-400/30 rounded-lg overflow-hidden bg-cyan-400/5">
                    <button
                      onClick={() => setShowMetricsDetail(!showMetricsDetail)}
                      className="w-full p-4 flex items-center justify-between hover:bg-cyan-400/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-cyan-400" />
                        <div className="text-left">
                          <div className="text-sm font-bold text-cyan-400">Real-Time Metrics Analysis</div>
                          <div className="text-xs text-green-400/60">WebSocket order flow & volume patterns</div>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-cyan-400 transition-transform ${showMetricsDetail ? 'rotate-90' : ''}`} />
                    </button>
            
                    {showMetricsDetail && (
                      <div className="p-4 border-t border-cyan-400/30 space-y-4">
                
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Metrics Direction</div>
                            <div className="text-sm font-bold text-cyan-400 capitalize">
                              {fusedSignal.metrics_signal.direction.replace('_', ' ')}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Metrics Confidence</div>
                            <div className="text-sm font-bold text-cyan-400">
                              {(fusedSignal.metrics_signal.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Token Phase</div>
                            <div className="text-sm font-bold text-cyan-400 capitalize">
                              {fusedSignal.metrics_signal.phase}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Volume Trend</div>
                            <div className="text-sm font-bold text-cyan-400 capitalize">
                              {fusedSignal.metrics_signal.volume_trend.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                
                        {/* Key Indicators */}
                        <div className="pt-3 border-t border-cyan-400/20">
                          <div className="text-xs font-bold text-green-400/60 mb-3">Key Indicators</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/30 rounded p-2">
                              <div className="text-xs text-green-400/60 mb-1">VTS (Volume Trend)</div>
                              <div className="text-lg font-bold text-cyan-400">{fusedSignal.metrics_signal.vts.toFixed(2)}</div>
                              <div className="text-xs text-cyan-400/60">
                                {fusedSignal.metrics_signal.vts > 2.0 ? '📈 Surging' : 
                                 fusedSignal.metrics_signal.vts > 1.3 ? '↗️ Rising' :
                                 fusedSignal.metrics_signal.vts > 0.7 ? '➡️ Stable' : '📉 Declining'}
                              </div>
                            </div>
                            <div className="bg-black/30 rounded p-2">
                              <div className="text-xs text-green-400/60 mb-1">PII (Pressure Index)</div>
                              <div className="text-lg font-bold text-cyan-400">{fusedSignal.metrics_signal.pii.toFixed(3)}</div>
                              <div className="text-xs text-cyan-400/60">
                                {fusedSignal.metrics_signal.pii > 0.3 ? '🟢 Strong buy' :
                                 fusedSignal.metrics_signal.pii > 0.1 ? '🟢 Buy pressure' :
                                 fusedSignal.metrics_signal.pii < -0.3 ? '🔴 Strong sell' :
                                 fusedSignal.metrics_signal.pii < -0.1 ? '🔴 Sell pressure' : '⚪ Neutral'}
                              </div>
                            </div>
                            {fusedSignal.metrics_signal.vei !== undefined && (
                              <div className="bg-black/30 rounded p-2">
                                <div className="text-xs text-green-400/60 mb-1">VEI (Exhaustion)</div>
                                <div className="text-lg font-bold text-cyan-400">{fusedSignal.metrics_signal.vei.toFixed(2)}</div>
                                <div className="text-xs text-cyan-400/60">
                                  {fusedSignal.metrics_signal.vei > 0.5 ? '✅ Healthy' : '⚠️ Exhausted'}
                                </div>
                              </div>
                            )}
                            {fusedSignal.metrics_signal.conviction_multiplier !== undefined && (
                              <div className="bg-black/30 rounded p-2">
                                <div className="text-xs text-green-400/60 mb-1">Conviction Quality</div>
                                <div className="text-lg font-bold text-cyan-400">{fusedSignal.metrics_signal.conviction_multiplier.toFixed(2)}</div>
                                <div className="text-xs text-cyan-400/60">
                                  {fusedSignal.metrics_signal.conviction_multiplier > 1.2 ? '💪 High' :
                                   fusedSignal.metrics_signal.conviction_multiplier < 0.8 ? '🤖 Artificial?' : '➡️ Normal'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                
                        {/* Detected Factors */}
                        {fusedSignal.metrics_signal.key_factors && fusedSignal.metrics_signal.key_factors.length > 0 && (
                          <div className="pt-3 border-t border-cyan-400/20">
                            <div className="text-xs font-bold text-green-400/60 mb-2">Detected Factors</div>
                            <div className="space-y-1">
                              {fusedSignal.metrics_signal.key_factors.map((factor, idx) => (
                                <div key={idx} className="text-xs text-cyan-400/80 flex items-start gap-2">
                                  <span className="mt-0.5">•</span>
                                  <span>{factor}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Liquidity Structure Breakdown */}
                {fusedSignal.slippage_signal && (
                  <div className="border-2 border-green-400/30 rounded-lg overflow-hidden bg-green-400/5">
                    <button
                      onClick={() => setShowSlippageDetail(!showSlippageDetail)}
                      className="w-full p-4 flex items-center justify-between hover:bg-green-400/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <div className="text-left">
                          <div className="text-sm font-bold text-green-400">Liquidity Structure Analysis</div>
                          <div className="text-xs text-green-400/60">Orderbook depth & slippage patterns</div>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-green-400 transition-transform ${showSlippageDetail ? 'rotate-90' : ''}`} />
                    </button>
            
                    {showSlippageDetail && (
                      <div className="p-4 border-t border-green-400/30 space-y-4">
                
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Slippage Direction</div>
                            <div className="text-sm font-bold text-green-400 capitalize">
                              {fusedSignal.slippage_signal.direction.replace('_', ' ')}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Slippage Confidence</div>
                            <div className="text-sm font-bold text-green-400">
                              {(fusedSignal.slippage_signal.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Market State</div>
                            <div className="text-sm font-bold text-green-400">
                              {fusedSignal.slippage_signal.state}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-green-400/60 mb-1">Liquidity Health</div>
                            <div className={`text-sm font-bold ${
                              fusedSignal.slippage_signal.liquidity_health === 'favorable' ? 'text-green-400' :
                              fusedSignal.slippage_signal.liquidity_health === 'healthy' ? 'text-cyan-400' :
                              fusedSignal.slippage_signal.liquidity_health === 'degrading' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {fusedSignal.slippage_signal.liquidity_health.toUpperCase()}
                            </div>
                          </div>
                        </div>
                
                        {/* Asymmetry Analysis */}
                        <div className="pt-3 border-t border-green-400/20">
                          <div className="text-xs font-bold text-green-400/60 mb-3">Asymmetry Analysis</div>
                          <div className="bg-black/30 rounded p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-green-400/60">Buy vs Sell Asymmetry</span>
                              <span className={`text-lg font-bold ${
                                fusedSignal.slippage_signal.asymmetry_ratio > 2.0 ? 'text-red-400' :
                                fusedSignal.slippage_signal.asymmetry_ratio > 1.5 ? 'text-yellow-400' :
                                fusedSignal.slippage_signal.asymmetry_ratio < 0.6 ? 'text-green-400' :
                                'text-cyan-400'
                              }`}>
                                {fusedSignal.slippage_signal.asymmetry_ratio.toFixed(2)}x
                              </span>
                            </div>
                            <div className="text-xs text-green-400/60">
                              {fusedSignal.slippage_signal.asymmetry_ratio > 2.0 ? '⚠️ Much harder to sell than buy' :
                               fusedSignal.slippage_signal.asymmetry_ratio > 1.5 ? '⚠️ Harder to sell than buy' :
                               fusedSignal.slippage_signal.asymmetry_ratio < 0.6 ? '✅ Easier to sell than buy' :
                               '➡️ Balanced buy/sell conditions'}
                            </div>
                          </div>
                        </div>
                
                        {/* Critical Warnings */}
                        {(fusedSignal.slippage_signal.is_honeypot || fusedSignal.slippage_signal.manipulation_detected) && (
                          <div className="pt-3 border-t border-red-400/30">
                            <div className="text-xs font-bold text-red-400 mb-2">🚨 CRITICAL WARNINGS</div>
                            <div className="space-y-2">
                              {fusedSignal.slippage_signal.is_honeypot && (
                                <div className="bg-red-600/20 border border-red-600/50 rounded p-2 text-xs text-red-400">
                                  <span className="font-bold">HONEYPOT DETECTED:</span> You will NOT be able to sell tokens
                                </div>
                              )}
                              {fusedSignal.slippage_signal.manipulation_detected && (
                                <div className="bg-orange-600/20 border border-orange-600/50 rounded p-2 text-xs text-orange-400">
                                  <span className="font-bold">MANIPULATION DETECTED:</span> Suspicious liquidity patterns found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                
                        {/* Detected Patterns */}
                        {fusedSignal.slippage_signal.key_factors && fusedSignal.slippage_signal.key_factors.length > 0 && (
                          <div className="pt-3 border-t border-green-400/20">
                            <div className="text-xs font-bold text-green-400/60 mb-2">Detected Patterns</div>
                            <div className="space-y-1">
                              {fusedSignal.slippage_signal.key_factors.map((factor, idx) => (
                                <div key={idx} className="text-xs text-green-400/80 flex items-start gap-2">
                                  <span className="mt-0.5">•</span>
                                  <span>{factor}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
              <Link to="/dashboard" className="px-3 py-1 text-green-400 text-sm font-bold rounded hover:bg-green-400/10">
                DASHBOARD
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

//

// ============================================
// DASHBOARD COMPONENT - Tracked Tokens Monitor
// ============================================

function Dashboard() {
  const navigate = useNavigate();
  const [trackedTokens, setTrackedTokens] = useState([]);
  const [tokenSignals, setTokenSignals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [addTokenAddress, setAddTokenAddress] = useState('');
  const [addingToken, setAddingToken] = useState(false);

  // Fetch tracked tokens and their signals on component mount
  useEffect(() => {
    loadDashboard();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadDashboard(true);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      // Step 1: Get list of tracked tokens from backend
      const statusResponse = await getTrackingStatus();
      
      if (!statusResponse.success) {
        throw new Error('Failed to fetch tracking status');
      }

      const tracked = statusResponse.tracked_tokens || [];
      setTrackedTokens(tracked);

      // Step 2: If there are tracked tokens, get fusion signals for each
      if (tracked.length > 0) {
        const tokenAddresses = tracked.map(t => t.token_address || t.address);
        
        try {
          // Use batch endpoint to get all signals at once
          const batchResponse = await getBatchFusedSignals(tokenAddresses);
          
          if (batchResponse.success) {
            setTokenSignals(batchResponse.results || {});
          }
        } catch (batchError) {
          console.error('Batch signals failed, fetching individually:', batchError);
          
          // Fallback: fetch signals individually if batch fails
          const signals = {};
          for (const token of tracked) {
            const addr = token.token_address || token.address;
            try {
              const fusionResult = await getFusedSignal(addr);
              if (fusionResult.success) {
                signals[addr] = {
                  signal: fusionResult.signal,
                  has_metrics: fusionResult.data_sources?.metrics_available,
                  has_slippage: fusionResult.data_sources?.slippage_available
                };
              }
            } catch (err) {
              console.error(`Failed to get signal for ${addr}:`, err);
              signals[addr] = { error: err.message };
            }
          }
          setTokenSignals(signals);
        }
      } else {
        setTokenSignals({});
      }

    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
      console.error('Dashboard load error:', err);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleAddToken = async () => {
    if (!addTokenAddress.trim()) return;
    
    setAddingToken(true);
    setError('');

    try {
      const result = await startTrackingToken(addTokenAddress.trim());
      
      if (result.success) {
        setAddTokenAddress('');
        // Reload dashboard to show the new token
        setTimeout(() => loadDashboard(), 2000); // Wait 2 seconds for backend to initialize tracking
      } else {
        setError(result.message || 'Failed to start tracking');
      }
    } catch (err) {
      setError(err.message || 'Failed to add token');
    }

    setAddingToken(false);
  };

  const handleStopTracking = async (tokenAddress) => {
    if (!confirm(`Stop tracking ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-4)}?`)) {
      return;
    }

    try {
      await stopTrackingToken(tokenAddress);
      // Reload dashboard to reflect the removal
      setTimeout(() => loadDashboard(), 1000);
    } catch (err) {
      setError(err.message || 'Failed to stop tracking');
    }
  };

  const handleAnalyzeToken = (tokenAddress) => {
    navigate(`/?token=${tokenAddress}`);
  };

  const getDirectionColor = (direction) => {
    if (direction === 'strong_bullish') return 'text-green-400 bg-green-400/20 border-green-400';
    if (direction === 'bullish') return 'text-green-300 bg-green-400/10 border-green-400/60';
    if (direction === 'neutral') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400';
    if (direction === 'bearish') return 'text-red-300 bg-red-400/10 border-red-400/60';
    if (direction === 'strong_bearish') return 'text-red-400 bg-red-400/20 border-red-400';
    return 'text-red-600 bg-red-600/30 border-red-600';
  };

  const getActionCodeColor = (code) => {
    if (code === 'BUY') return 'bg-green-400/20 text-green-400 border-green-400/50';
    if (code === 'SELL') return 'bg-red-400/20 text-red-400 border-red-400/50';
    if (code === 'EXIT') return 'bg-red-600/30 text-red-600 border-red-600';
    if (code === 'AVOID') return 'bg-orange-400/20 text-orange-400 border-orange-400/50';
    return 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50';
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="border-2 border-green-400 rounded-lg p-4 mb-6 bg-black/50 backdrop-blur">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  TRACKING DASHBOARD
                </h1>
                <p className="text-xs text-green-400/60">Real-time monitoring of tracked tokens</p>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex gap-2 border border-green-400/30 rounded p-1">
              <Link to="/" className="px-3 py-1 text-green-400 text-sm font-bold rounded hover:bg-green-400/10">
                TERMINAL
              </Link>
              <Link to="/marketplace" className="px-3 py-1 text-green-400 text-sm font-bold rounded hover:bg-green-400/10">
                MARKETPLACE
              </Link>
              <Link to="/dashboard" className="px-3 py-1 bg-green-400 text-black text-sm font-bold rounded">
                DASHBOARD
              </Link>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400/60">
                  {trackedTokens.length} token{trackedTokens.length !== 1 ? 's' : ''} tracked
                </span>
              </div>
              <button
                onClick={() => loadDashboard()}
                disabled={refreshing || loading}
                className="px-3 py-1 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400 hover:bg-green-400/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Add Token Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={addTokenAddress}
                onChange={(e) => setAddTokenAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !addingToken && handleAddToken()}
                placeholder="Add token address..."
                className="bg-black border border-green-400/30 rounded px-3 py-1 text-sm text-green-400 placeholder-green-400/30 focus:border-green-400 focus:outline-none w-64"
              />
              <button
                onClick={handleAddToken}
                disabled={addingToken || !addTokenAddress.trim()}
                className="px-4 py-1 bg-green-400 text-black text-sm font-bold rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {addingToken ? 'Adding...' : 'Track'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50">
            <RefreshCw className="w-16 h-16 mx-auto mb-4 text-green-400 animate-spin" />
            <h3 className="text-xl font-bold text-green-400/60 mb-2">LOADING DASHBOARD...</h3>
            <p className="text-green-400/40 text-sm">Fetching tracked tokens and signals</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && trackedTokens.length === 0 && (
          <div className="border-2 border-green-400/30 rounded-lg p-12 text-center bg-black/50">
            <Brain className="w-16 h-16 mx-auto mb-4 text-green-400/30" />
            <h3 className="text-xl font-bold text-green-400/60 mb-2">NO TOKENS TRACKED</h3>
            <p className="text-green-400/40 text-sm mb-4">
              Add a token address above to start real-time tracking
            </p>
            <p className="text-green-400/40 text-xs">
              Tracked tokens will appear here with live fusion signals
            </p>
          </div>
        )}

        {/* Token Grid */}
        {!loading && trackedTokens.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {trackedTokens.map((token) => {
              const addr = token.token_address || token.address;
              const signalData = tokenSignals[addr];
              const signal = signalData?.signal;
              const hasError = signalData?.error;

              return (
                <div
                  key={addr}
                  className="border-2 border-green-400/30 rounded-lg bg-black/50 hover:border-green-400 transition-all overflow-hidden"
                >
                  {/* Token Header */}
                  <div className="p-4 border-b border-green-400/30 bg-green-400/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-cyan-400">
                          {addr.slice(0, 6)}...{addr.slice(-4)}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(addr)}
                          className="p-1 hover:bg-green-400/10 rounded transition-all"
                        >
                          <Copy className="w-3 h-3 text-green-400/50 hover:text-green-400" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleStopTracking(addr)}
                        className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                    {token.started_at && (
                      <div className="text-xs text-green-400/60">
                        Tracking for {Math.floor((Date.now() - token.started_at * 1000) / 60000)}m
                      </div>
                    )}
                  </div>

                  {/* Signal Display */}
                  {hasError ? (
                    <div className="p-4">
                      <div className="text-sm text-red-400">Signal unavailable</div>
                      <div className="text-xs text-green-400/60 mt-1">{signalData.error}</div>
                    </div>
                  ) : signal ? (
                    <div className="p-4 space-y-3">
                      {/* Direction Badge */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-3 py-1 rounded border ${getDirectionColor(signal.direction)}`}>
                          {signal.direction.toUpperCase().replace('_', ' ')}
                        </span>
                        <span className="text-lg font-bold text-purple-400">
                          {(signal.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Action Recommendation */}
                      <div className={`border rounded p-3 ${getActionCodeColor(signal.action_code)}`}>
                        <div className="text-xs font-bold mb-1">{signal.action_code}</div>
                        <div className="text-xs opacity-80">{signal.action}</div>
                      </div>

                      {/* Systems Agreement */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-400/60">Systems:</span>
                        <span className={signal.systems_agree ? 'text-green-400' : 'text-orange-400'}>
                          {signal.systems_agree ? '✓ Agree' : '⚠ Disagree'}
                        </span>
                      </div>

                      {/* Data Sources */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded ${signalData.has_metrics ? 'bg-cyan-400/20 text-cyan-400' : 'bg-red-400/20 text-red-400'}`}>
                          {signalData.has_metrics ? 'Metrics ✓' : 'No Metrics'}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${signalData.has_slippage ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}>
                          {signalData.has_slippage ? 'Slippage ✓' : 'No Slippage'}
                        </span>
                      </div>

                      {/* Risk Level */}
                      {signal.risk_level && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-400/60">Risk:</span>
                          <span className={`font-bold ${
                            signal.risk_level === 'extreme' ? 'text-red-600' :
                            signal.risk_level === 'high' ? 'text-red-400' :
                            signal.risk_level === 'medium' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {signal.risk_level.toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Analyze Button */}
                      <button
                        onClick={() => handleAnalyzeToken(addr)}
                        className="w-full px-3 py-2 bg-green-400 text-black text-sm font-bold rounded hover:brightness-110 transition-all flex items-center justify-center gap-2"
                      >
                        <Brain className="w-4 h-4" />
                        ANALYZE
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 text-green-400/30 animate-spin" />
                      <div className="text-xs text-green-400/60">Loading signal...</div>
                    </div>
                  )}
                </div>
              );
            })}
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
    <AccessControl>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Terminal />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </HashRouter>
    </AccessControl>
  );
}

export default App;
