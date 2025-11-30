import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Wallet, Copy, RefreshCw, LogOut, Download, AlertTriangle, User, PlusCircle } from 'lucide-react';

// Use your existing backend proxy for Solana RPC calls
const CONNECTION = new Connection('https://orbonsolana.up.railway.app/api/proxy/helius');

export function PrivyWallet() {
    // ✅ FIX: Added 'createWallet' to this list so the code can use it
    const { ready, authenticated, login, logout, user, createWallet } = usePrivy();
    const { wallets } = useWallets();

    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Debug states
    const [creationError, setCreationError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Find Solana wallet
    const solanaWallet = wallets.find((wallet) => wallet.walletClientType === 'privy' && wallet.chainType === 'solana');

    // Fetch balance
    useEffect(() => {
        if (solanaWallet?.address) {
            fetchBalance(solanaWallet.address);
        }
    }, [solanaWallet?.address]);

    // Force Create Wallet Effect
    useEffect(() => {
        // If the user is logged in, the SDK is ready, but NO Solana wallet exists...
        if (ready && authenticated && !solanaWallet && !isCreating && !creationError) {
            handleCreateWallet();
        }
    }, [ready, authenticated, solanaWallet]);

    const handleCreateWallet = async () => {
        setIsCreating(true);
        setCreationError('');
        try {
            console.log("Attempting to create Solana wallet...");
            // Now this function exists because we added it to the const above
            await createWallet({ chainType: 'solana' });
        } catch (err) {
            console.error("Wallet creation failed:", err);
            setCreationError(err.message || JSON.stringify(err));
        } finally {
            setIsCreating(false);
        }
    };

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

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    // 1. LOADING
    if (!ready) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 border border-green-400/30 rounded">
                <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                <span className="text-xs text-green-400/60">Loading...</span>
            </div>
        );
    }

    // 2. LOGIN BUTTON
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

    // 3. STUCK CREATING WALLET (DEBUG VIEW)
    if (!solanaWallet?.address) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded">
                    {isCreating ? (
                        <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    )}
                    <span className="text-xs text-yellow-400">
                        {isCreating ? 'Creating Solana wallet...' : 'Wallet required'}
                    </span>
                </div>

                {creationError && (
                    <div className="px-4 py-2 bg-red-400/20 border border-red-400/50 rounded max-w-[300px]">
                        <p className="text-[10px] text-red-400 break-words font-mono">
                            ERROR: {creationError}
                        </p>
                        <button 
                            onClick={handleCreateWallet}
                            className="mt-2 text-xs bg-red-400 text-black px-2 py-1 rounded font-bold"
                        >
                            TRY AGAIN
                        </button>
                    </div>
                )}

                <button 
                    onClick={logout}
                    className="text-[10px] text-red-400 underline hover:text-red-300"
                >
                    Stuck? Click here to Logout & Reset
                </button>
            </div>
        );
    }

    // 4. AUTHENTICATED & READY
    return (
        <div className="relative group">
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
                        <button onClick={() => copyToClipboard(solanaWallet.address)}>
                            <Copy className="w-3 h-3 text-cyan-400/60 hover:text-cyan-400" />
                        </button>
                    </div>
                    <button 
                        onClick={logout} 
                        className="text-[10px] text-red-400/60 hover:text-red-400 flex items-center gap-1 mt-1 justify-end"
                    >
                        <LogOut className="w-3 h-3" /> Disconnect
                    </button>
                </div>
            </div>
        </div>
    );
}
