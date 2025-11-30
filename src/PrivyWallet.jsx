import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Wallet, Copy, RefreshCw, LogOut, Download, AlertTriangle, User } from 'lucide-react';

// Use your existing backend proxy for Solana RPC calls
const CONNECTION = new Connection('https://orbonsolana.up.railway.app/api/proxy/helius');

/**
 * PrivyWallet Component
 * 
 * This component handles all wallet-related UI and functionality using Privy's
 * authentication system. It provides a clean interface for login, wallet display,
 * and account management that integrates seamlessly with your terminal.
 */
export function PrivyWallet() {
    // Privy hooks for authentication state and wallet access
    const { ready, authenticated, login, logout, user } = usePrivy();
    const { wallets } = useWallets();
    
    // Local state for wallet information
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Get the Solana wallet from the user's wallets array
    // Privy can support multiple chains, so we filter for Solana specifically
    const solanaWallet = wallets.find((wallet) => wallet.walletClientType === 'privy' && wallet.chainType === 'solana');

============================================
    // ✅ NEW CODE: FORCE SOLANA WALLET CREATION
    // ============================================
    useEffect(() => {
        // If the user is logged in, the SDK is ready, but NO Solana wallet exists...
        if (ready && authenticated && !solanaWallet) {
            console.log("User has no Solana wallet. Creating one now...");
            
            // Force create a Solana wallet
            createWallet({ chainType: 'solana' })
                .then((wallet) => {
                    console.log("Solana wallet created successfully:", wallet);
                    // The UI will auto-update because 'wallets' hook will trigger a re-render
                })
                .catch((error) => {
                    console.error("Failed to create Solana wallet:", error);
                });
        }
    }, [ready, authenticated, solanaWallet, createWallet]);
    // ============================================
    // END NEW CODE
    // ============================================

    // Fetch balance whenever the wallet address changes
    useEffect(() => {
        if (solanaWallet?.address) {
            fetchBalance(solanaWallet.address);
        }
    }, [solanaWallet?.address]);

    /**
     * Fetch the SOL balance for the current wallet address
     * This uses the Solana connection to query the blockchain
     */
    const fetchBalance = async (address) => {
        try {
            setLoading(true);
            const publicKey = new PublicKey(address);
            const bal = await CONNECTION.getBalance(publicKey);
            setBalance(bal / LAMPORTS_PER_SOL);
        } catch (e) {
            console.error("Balance fetch failed:", e);
            setBalance(0);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Copy text to clipboard with visual feedback
     */
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    /**
     * Format wallet addresses for display (first 4 + last 4 characters)
     */
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    /**
     * Export wallet details to a text file
     * This gives users a backup of their wallet address and account info
     */
    const exportWalletInfo = () => {
        if (!solanaWallet?.address) return;
        
        const blob = new Blob([
            `ORB TERMINAL - WALLET INFORMATION\n`,
            `Generated: ${new Date().toISOString()}\n`,
            `\n`,
            `ACCOUNT EMAIL: ${user?.email?.address || 'N/A'}\n`,
            `WALLET ADDRESS:\n${solanaWallet.address}\n`,
            `\n`,
            `This wallet is managed by Privy and linked to your account.\n`,
            `To access this wallet, log in to Orb Terminal with the same account.\n`,
            `\n`,
            `To export your private key for use in other wallets:\n`,
            `1. Click "Export Wallet" in the Privy settings\n`,
            `2. Complete the security verification\n`,
            `3. Save your private key securely\n`,
        ], { type: 'text/plain' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orb-wallet-info-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ============================================
    // RENDER: Loading State
    // ============================================
    // Privy needs a moment to initialize and check authentication state
    if (!ready) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 border border-green-400/30 rounded">
                <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                <span className="text-xs text-green-400/60">Loading...</span>
            </div>
        );
    }

    // ============================================
    // RENDER: Not Authenticated (Login Button)
    // ============================================
    if (!authenticated) {
        return (
            <button 
                onClick={login}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded transition-all shadow-[0_0_15px_rgba(74,222,128,0.3)]"
            >
                <User className="w-4 h-4" />
                CONNECT WALLET
            </button>
        );
    }

    // ============================================
    // RENDER: Authenticated but No Wallet Yet
    // ============================================
    // This state should be rare because Privy auto-creates wallets,
    // but it can happen briefly during initial authentication
    if (!solanaWallet?.address) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-400">Creating wallet...</span>
            </div>
        );
    }

    // ============================================
    // RENDER: Authenticated with Wallet (Main Display)
    // ============================================
    return (
        <div className="relative group">
            {/* Compact wallet display for the terminal header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded cursor-default">
                <div className="flex flex-col items-end">
                    <div className="text-xs text-green-400/60 font-bold tracking-wider">BALANCE</div>
                    <div className="text-green-400 font-bold font-mono">
                        {loading ? '...' : `${balance.toFixed(4)} SOL`}
                    </div>
                </div>
                
                <div className="h-8 w-[1px] bg-green-400/30"></div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 font-mono">
                            {formatAddress(solanaWallet.address)}
                        </span>
                        <button 
                            onClick={() => copyToClipboard(solanaWallet.address)}
                            className="hover:scale-110 transition"
                        >
                            <Copy className="w-3 h-3 text-cyan-400/60 hover:text-cyan-400" />
                        </button>
                    </div>
                    <button 
                        onClick={() => fetchBalance(solanaWallet.address)} 
                        className="text-[10px] text-green-400/60 hover:text-green-400 flex items-center gap-1 mt-1"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Expanded dropdown that appears on hover */}
            <div className="absolute top-full right-0 mt-2 w-80 bg-black border-2 border-green-400 rounded-lg p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                
                {/* Header with user info */}
                <div className="border-b border-green-400/30 pb-3 mb-3">
                    <h3 className="text-green-400 font-bold flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4" /> YOUR TRADING WALLET
                    </h3>
                    {user?.email?.address && (
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                            <User className="w-3 h-3" />
                            <span className="truncate">{user.email.address}</span>
                        </div>
                    )}
                </div>
                
                {/* Info banner about Privy wallets */}
                <div className="bg-cyan-400/10 border border-cyan-400/30 rounded p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <p className="text-cyan-400 text-xs leading-relaxed">
                            This wallet is securely managed by Privy and linked to your account. 
                            Access it from any device by logging in.
                        </p>
                    </div>
                </div>

                {/* Deposit address section */}
                <div className="mb-4 bg-green-400/10 p-3 rounded border border-green-400/20">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-green-400/80 font-bold">DEPOSIT ADDRESS:</p>
                        <button 
                            onClick={() => copyToClipboard(solanaWallet.address)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                            <Copy className="w-3 h-3" />
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <div className="text-[10px] break-all font-mono text-cyan-400 bg-black/50 p-2 rounded select-all border border-cyan-400/20">
                        {solanaWallet.address}
                    </div>
                    <p className="text-[9px] text-gray-400 mt-2 italic">
                        Send SOL to this address to fund your trading wallet
                    </p>
                </div>

                {/* Balance display with refresh */}
                <div className="mb-4 bg-black/50 border border-green-400/20 rounded p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-400/60 mb-1">Current Balance</p>
                            <p className="text-lg text-green-400 font-bold font-mono">
                                {balance.toFixed(4)} SOL
                            </p>
                        </div>
                        <button
                            onClick={() => fetchBalance(solanaWallet.address)}
                            disabled={loading}
                            className="p-2 bg-green-400/10 hover:bg-green-400/20 border border-green-400/30 rounded transition"
                        >
                            <RefreshCw className={`w-4 h-4 text-green-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                    <button 
                        onClick={exportWalletInfo}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/30 text-cyan-400 text-xs font-bold rounded transition"
                    >
                        <Download className="w-3 h-3" /> EXPORT WALLET INFO
                    </button>
                    
                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-2 border border-red-400/30 text-red-400 text-xs font-bold rounded hover:bg-red-400/10 transition"
                    >
                        <LogOut className="w-3 h-3" /> DISCONNECT
                    </button>
                </div>

                {/* Help text */}
                <p className="text-[9px] text-gray-500 mt-3 text-center italic">
                    Your wallet follows you across devices when logged in
                </p>
            </div>
        </div>
    );
}

/**
 * USAGE NOTES FOR DEVELOPERS:
 * 
 * 1. AUTHENTICATION FLOW:
 *    When users click "CONNECT WALLET", Privy shows a modal with login options.
 *    After authentication, a Solana wallet is automatically created.
 *    
 * 2. WALLET ACCESS:
 *    The solanaWallet object contains the wallet address and methods for signing.
 *    Use solanaWallet.address to get the public address.
 *    Use wallet signing methods when building your swap functionality.
 * 
 * 3. BALANCE UPDATES:
 *    Balance is fetched when the component mounts and when the address changes.
 *    Users can manually refresh by clicking the refresh button.
 *    Consider adding auto-refresh after transactions complete.
 * 
 * 4. MULTI-DEVICE SUPPORT:
 *    Users who log in on different devices will see the same wallet automatically.
 *    The wallet is tied to their Privy account, not browser localStorage.
 * 
 * 5. PRIVATE KEY EXPORT:
 *    Users can export their private key through Privy's built-in interface.
 *    The "Export Wallet Info" button provides account details, not the private key itself.
 *    For actual private key export, guide users to Privy's security settings.
 */