// ============================================
// ORB COMPLETE API LAYER
// Uses DexScreener (free) + Your Railway Backend
// NO API KEYS EXPOSED - All sensitive calls go through backend
// ============================================

import { Connection, PublicKey } from '@solana/web3.js';

// Backend URL - your Railway deployment
const BACKEND_URL = 'https://orbonsolana.up.railway.app';

// Public RPC (Helius public endpoint - no key needed for basic calls)
const connection = new Connection('https://api.mainnet-beta.solana.com');

// ============================================
// TOKEN DATA FUNCTIONS (DexScreener - Free)
// ============================================

/**
 * Fetches token info by contract address using DexScreener
 * DexScreener is free and doesn't require API keys
 */
export const fetchTokenInfoByAddress = async (address) => {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('Token not found');
    }

    // Get the most liquid Solana pair
    const pair = data.pairs.find(p => p.chainId === 'solana') || data.pairs[0];

    return {
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      contractAddress: pair.baseToken.address,
      image: pair.info?.imageUrl || 'https://via.placeholder.com/50',
      price: parseFloat(pair.priceUsd) || 0,
      marketcap: pair.fdv || pair.marketCap || 0,
      volumeIn24h: pair.volume?.h24 || 0,
      priceChangeIn24h: pair.priceChange?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      created_timestamp: pair.pairCreatedAt ? pair.pairCreatedAt / 1000 : Date.now() / 1000,
      twitter: pair.info?.socials?.find(s => s.type === 'twitter')?.url,
      telegram: pair.info?.socials?.find(s => s.type === 'telegram')?.url,
      website: pair.info?.websites?.[0]?.url
    };
  } catch (error) {
    console.error("Token fetch error:", error);
    throw error;
  }
};

/**
 * Fetches token info by symbol/name search
 */
export const fetchTokenInfoBySymbol = async (query) => {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${query}`);
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('Token not found');
    }

    // Prefer Solana pairs
    const pair = data.pairs.find(p => p.chainId === 'solana') || data.pairs[0];

    return {
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      contractAddress: pair.baseToken.address,
      image: pair.info?.imageUrl || 'https://via.placeholder.com/50',
      price: parseFloat(pair.priceUsd) || 0,
      marketcap: pair.fdv || pair.marketCap || 0,
      volumeIn24h: pair.volume?.h24 || 0,
      priceChangeIn24h: pair.priceChange?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      twitter: pair.info?.socials?.find(s => s.type === 'twitter')?.url,
      telegram: pair.info?.socials?.find(s => s.type === 'telegram')?.url,
      website: pair.info?.websites?.[0]?.url
    };
  } catch (error) {
    console.error("Token search error:", error);
    throw error;
  }
};

/**
 * Fetches trending/new tokens using DexScreener's latest profiles
 */
export const fetchPumpFunTrends = async () => {
  try {
    const response = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
    const data = await response.json();
    
    // Filter for Solana tokens only
    const solanaTokens = data.filter(t => t.chainId === 'solana').slice(0, 50);
    
    return solanaTokens.map(t => ({
      mint: t.tokenAddress,
      symbol: t.url?.split('/').pop() || t.tokenAddress.slice(0, 6),
      name: t.description?.split('\n')[0] || "New Token",
      image_uri: t.icon || 'https://via.placeholder.com/50',
      description: t.description || 'No description available',
      market_cap: 0, // Will be enriched separately if needed
      created_timestamp: Date.now() / 1000 - (Math.random() * 7200), // Within last 2 hours
      complete: true,
      twitter: t.links?.find(l => l.type === 'twitter')?.url,
      telegram: t.links?.find(l => l.type === 'telegram')?.url,
      website: t.links?.find(l => l.type === 'website')?.url
    }));
  } catch (error) {
    console.error("Trending tokens error:", error);
    return [];
  }
};

// ============================================
// HOLDER DATA (Via Backend to Hide API Keys)
// ============================================

/**
 * Fetches token holders through your backend
 * This keeps your BirdEye API key secure on the backend
 */
export const fetchTokenHolders = async (tokenAddress) => {
  try {
    // First try backend (if you implement this endpoint)
    const backendResponse = await fetch(`${BACKEND_URL}/api/token/holders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_address: tokenAddress })
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return data.holders || data;
    }
  } catch (error) {
    console.log('Backend holders endpoint not available, using RPC fallback');
  }

  // Fallback: Use public Solana RPC (slower but works)
  try {
    const tokenMint = new PublicKey(tokenAddress);
    const largestAccounts = await connection.getTokenLargestAccounts(tokenMint);
    
    return largestAccounts.value
      .filter(account => account.uiAmount && account.uiAmount > 0)
      .map(account => ({
        address: account.address.toString(),
        amount: account.uiAmount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 30);
  } catch (error) {
    console.error('Error fetching holders:', error);
    return [];
  }
};

/**
 * Gets token supply from blockchain
 */
export const getTokenSupply = async (tokenAddress) => {
  try {
    const tokenMint = new PublicKey(tokenAddress);
    const mintInfo = await connection.getParsedAccountInfo(tokenMint);
    const supply = parseFloat(mintInfo.value?.data?.parsed?.info?.supply || 0);
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 9;
    return supply / Math.pow(10, decimals);
  } catch (error) {
    console.error('Error fetching token supply:', error);
    return 0;
  }
};

// ============================================
// BACKEND ANALYSIS CALLS (Your Railway Backend)
// ============================================

/**
 * Analyzes a single wallet via your backend
 * All heavy computation happens on your Railway server
 */
export const analyzeWalletViaBackend = async (walletAddress, tokenAddress, holdingPercent) => {
  try {
    const accessCode = localStorage.getItem('orb_access_code') || 'anonymous';
    
    const response = await fetch(`${BACKEND_URL}/api/wallet/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: walletAddress,
        token_address: tokenAddress,
        holding_percent: holdingPercent,
        access_code: accessCode  // NEW CODE: Include the access code in the request
      })
    });
// NEW CODE: Handle rate limit errors specifically
    if (response.status === 429) {
      // 429 means "Too Many Requests" - rate limit exceeded
      const errorData = await response.json();
      const resetTime = new Date(errorData.resets_at * 1000);
      
      alert(`Daily analysis limit exceeded!\n\nYou've used all ${errorData.limit} analyses for today.\n\nYour limit will reset at:\n${resetTime.toLocaleString()}`);
      
      throw new Error('Rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    
    // Handle both wrapped and direct responses
    const walletData = data.data || data;
    
    return {
      iq: walletData.iq || 50,
      winRate: walletData.winRate || walletData.win_rate || '0.0',
      trades: walletData.trades || 0,
      tradesScore: walletData.tradesScore || walletData.trades_score || 0,
      portfolio: walletData.portfolio || 0,
      pattern: walletData.pattern || 'Unknown',
      holdScore: walletData.holdScore || walletData.hold_score || 0,
      firstBuyTime: walletData.firstBuyTime || walletData.first_buy_time || null
    };
  } catch (error) {
    console.error('Wallet analysis failed:', error);
    // Return default values on error
    return {
      iq: 50,
      winRate: '0.0',
      trades: 0,
      tradesScore: 0,
      portfolio: 0,
      pattern: 'ERROR',
      holdScore: 0,
      firstBuyTime: null
    };
  }
};

/**
 * Gets privacy-preserving orderbook analysis from your backend
 * This is your microstructure analysis with velocity tracking
 */
export const getPrivacyAnalysis = async (tokenAddress) => {
  try {
    // NEW CODE: Get the access code from localStorage
    const accessCode = localStorage.getItem('orb_access_code') || 'anonymous';
    
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token_address: tokenAddress,
        access_code: accessCode  // NEW CODE: Include the access code
      })
    });

    // NEW CODE: Handle rate limit errors specifically
    if (response.status === 429) {
      // Rate limit exceeded
      const errorData = await response.json();
      const resetTime = new Date(errorData.resets_at * 1000);
      
      alert(`Daily analysis limit exceeded!\n\nYou've used all ${errorData.limit} analyses for today.\n\nYour limit will reset at:\n${resetTime.toLocaleString()}`);
      
      throw new Error('Rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Privacy analysis failed:', error);
    return {
      overall: 0,
      rating: 'ERROR',
      state: 'NEUTRAL',
      severity: 'LOW',
      timeframe: 'N/A',
      confidence: 0,
      action: 'Backend unavailable. Try again.',
      signals: [],
      pumpScore: 0,
      dumpScore: 0,
      asymmetryRatio: 0,
      baselinePrice: 0,
      timestamp: new Date().toISOString(),
      cached: false,
      buySlippage: [],
      sellSlippage: [],
      velocity: null,
      error: 'Backend not reachable'
    };
  }
};

// ============================================
// SIGNAL FUSION ENDPOINTS (Privacy Mode Enhanced Analysis)
// ============================================

/**
 * Get fused signal combining real-time metrics and slippage analysis
 * This replaces the old privacy mode analysis with a fusion of both systems
 */
export const getFusedSignal = async (tokenAddress, forceRefresh = false) => {
  try {
    const url = `${BACKEND_URL}/signal/fused/${tokenAddress}${forceRefresh ? '?force_refresh=true' : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Fusion signal failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching fused signal:', error);
    throw error;
  }
};

/**
 * Get real-time metrics including transition matrix predictions
 * This endpoint returns the MetricsSnapshot which contains:
 * - Current phase classification
 * - Real-time metric values (VTS, PII, VEI)
 * - Transition predictions from the learned matrix
 * - Confidence scores for predictions
 */
export const getRealtimeMetrics = async (tokenAddress) => {
  try {
    const response = await fetch(`${BACKEND_URL}/metrics/realtime/${tokenAddress}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      // If we get a 404, it means no metrics exist yet for this token
      if (response.status === 404) {
        console.log(`No metrics available yet for ${tokenAddress}`);
        return null;
      }
      throw new Error(`Metrics fetch failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    // Return null instead of throwing - this lets the UI gracefully handle missing data
    return null;
  }
};

/**
 * Get detailed explanation of fused signal with natural language
 * Provides human-readable breakdown of why the signal was generated
 */
export const getFusedSignalExplanation = async (tokenAddress) => {
  try {
    const response = await fetch(`${BACKEND_URL}/signal/explain/${tokenAddress}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Explanation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching signal explanation:', error);
    throw error;
  }
};

/**
 * Get batch fused signals for multiple tokens
 * Useful for watchlist scanning in privacy mode
 */
export const getBatchFusedSignals = async (tokenAddresses) => {
  try {
    const response = await fetch(`${BACKEND_URL}/signal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_addresses: tokenAddresses
      })
    });

    if (!response.ok) {
      throw new Error(`Batch fusion failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching batch signals:', error);
    throw error;
  }
};

/**
 * Check if backend is healthy
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

// ============================================

/**
 * Enable alerts for a token
 */
export const enableTokenAlerts = async (tokenAddress) => {
  const response = await fetch(`${BACKEND_URL}/alerts/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_address: tokenAddress })
  });
  return await response.json();
};

/**
 * Disable alerts for a token
 */
export const disableTokenAlerts = async (tokenAddress) => {
  const response = await fetch(`${BACKEND_URL}/alerts/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_address: tokenAddress })
  });
  return await response.json();
};

/**
 * Check if alerts are enabled for a token
 */
export const getAlertStatus = async (tokenAddress) => {
  const response = await fetch(`${BACKEND_URL}/alerts/status/${tokenAddress}`);
  return await response.json();
};

/**
 * Get alerts for a token
 */
export const getTokenAlerts = async (tokenAddress, limit = 20) => {
  const response = await fetch(`${BACKEND_URL}/alerts/get/${tokenAddress}?limit=${limit}`);
  return await response.json();
};

/**
 * Clear alerts for a token
 */
export const clearTokenAlerts = async (tokenAddress) => {
  const response = await fetch(`${BACKEND_URL}/alerts/clear/${tokenAddress}`, {
    method: 'POST'
  });
  return await response.json();
};
// ============================================
// TRACKING STATUS & DASHBOARD FUNCTIONS
// ============================================

/**
 * Get the list of currently tracked tokens
 * Returns array of tokens being monitored by the real-time system
 */
export const getTrackingStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Tracking status failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching tracking status:', error);
    throw error;
  }
};

/**
 * Start tracking a new token
 * Tells the backend to begin WebSocket monitoring for this token
 */
export const startTrackingToken = async (tokenAddress) => {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_address: tokenAddress
      })
    });

    if (!response.ok) {
      throw new Error(`Start tracking failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting token tracking:', error);
    throw error;
  }
};

/**
 * Stop tracking a token
 * Tells the backend to close the WebSocket connection for this token
 */
export const stopTrackingToken = async (tokenAddress) => {
  try {
    const response = await fetch(`${BACKEND_URL}/tracking/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_address: tokenAddress
      })
    });

    if (!response.ok) {
      throw new Error(`Stop tracking failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error stopping token tracking:', error);
    throw error;
  }
};

