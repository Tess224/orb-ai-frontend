import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Keypair, clusterApiUrl } from '@solana/web3.js';
import { Copy, RefreshCw, LogOut, User, Eye, EyeOff } from 'lucide-react';
import bs58 from 'bs58';

// 🛑 CHANGED: Using Public RPC instead of your Proxy to guarantee data access
// 'confirmed' means we see the balance faster (don't have to wait for full finalization)
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

export function PrivyWallet() {
    const { authenticated, login, logout } = usePrivy();
    const [balance, setBalance] = useState(0);
    const [localWallet, setLocalWallet] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [statusMsg, setStatusMsg] = useState(''); // Added for debugging

    // 1. Load/Create Wallet
    useEffect(() => {
        if (authenticated) {
            const savedKey = localStorage.getItem('orb_solana_key');
            if (savedKey) {
                try {
                    const secretKey = Uint8Array.from(JSON.parse(savedKey));
                    const keypair = Keypair.fromSecretKey(secretKey);
                    setLocalWallet(keypair);
                } catch (e) {
                    console.error("Key load error", e);
                }
            } else {
                const keypair = Keypair.generate();
                const secretKey = Array.from(keypair.secretKey);
                localStorage.setItem('orb_solana_key', JSON.stringify(secretKey));
                setLocalWallet(keypair);
            }
        }
    }, [authenticated]);

    // 2. Fetch Balance Function
    const fetchBalance = useCallback(async () => {
        if (!localWallet?.publicKey) return;
        
        try {
            setLoading(true);
            setStatusMsg('Fetching...');
            
            // Explicitly checking 'confirmed' status
            const bal = await CONNECTION.getBalance(localWallet.publicKey, 'confirmed');
            
            console.log("Fetched Balance:", bal); // Check console to see raw number
            setBalance(bal / LAMPORTS_PER_SOL);
            setStatusMsg('Updated');
            
            // Clear status after 2 seconds
            setTimeout(() => setStatusMsg(''), 2000);
        } catch(e) { 
            console.error("Balance fetch failed", e);
            setStatusMsg('RPC Error');
        } finally {
            setLoading(false);
        }
    }, [localWallet]);

    // 3. Auto-Poll Balance (Every 10 seconds)
    useEffect(() => {
        if (localWallet) {
            fetchBalance(); 
            const interval = setInterval(fetchBalance, 10000);
            return () => clearInterval(interval);
        }
    }, [localWallet, fetchBalance]);

    const copyAddress = () => {
        if (localWallet) {
            navigator.clipboard.writeText(localWallet.publicKey.toString());
            alert("Address Copied!");
        }
    };

    const copyPrivateKey = () => {
        if (localWallet) {
             try {
                 const key = bs58.encode(localWallet.secretKey);
                 navigator.clipboard.writeText(key);
                 alert("Private Key Copied!");
             } catch (e) {
                 const rawKey = `[${localWallet.secretKey.toString()}]`;
                 navigator.clipboard.writeText(rawKey);
                 alert("Private Key Copied! (Raw Format)");
             }
        }
    };

    const resetWallet = () => {
        if (confirm("Wait! Have you backed up your key? This will DELETE your current wallet.")) {
            localStorage.removeItem('orb_solana_key');
            setLocalWallet(null);
            setBalance(0);
            window.location.reload(); 
        }
    };

    if (!authenticated) {
        return (
            <button onClick={login} className="flex items-center gap-2 px-4 py-2 bg-green-400 text-black font-bold rounded shadow-[0_0_10px_#4ade80]">
                <User className="w-4 h-4" /> LOGIN TO TRADE
            </button>
        );
    }

    if (!localWallet) return <div className="text-green-400">Loading wallet...</div>;

    return (
        <div className="flex flex-col items-end gap-2">
            {/* Main Bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-green-400/60 font-bold">BALANCE</span>
                    <span className="text-green-400 font-bold font-mono">
                        {balance.toFixed(4)} SOL
                    </span>
                </div>
                
                <div className="h-8 w-[1px] bg-green-400/30"></div>

                {/* Address & Refresh */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-cyan-400 font-mono">
                        {localWallet.publicKey.toString().slice(0, 4)}...{localWallet.publicKey.toString().slice(-4)}
                    </span>
                    
                    <button onClick={copyAddress} title="Copy Address">
                        <Copy className="w-3 h-3 text-cyan-400/60 hover:text-cyan-400" />
                    </button>

                    <button onClick={fetchBalance} disabled={loading} title="Refresh Balance">
                        <RefreshCw className={`w-3 h-3 text-green-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            
            {/* Status Message (for debugging) */}
            {statusMsg && <div className="text-[10px] text-yellow-400">{statusMsg}</div>}

            {/* Tools Bar */}
            <div className="flex gap-3 text-[10px]">
                <button 
                    onClick={() => setShowKey(!showKey)} 
                    className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showKey ? "Hide Key" : "Show Key"}
                </button>
                
                {showKey && (
                    <button onClick={copyPrivateKey} className="text-yellow-400 font-bold underline">
                        Copy Key
                    </button>
                )}

                <button onClick={resetWallet} className="text-red-400 hover:text-red-300">
                    Reset
                </button>
                <button onClick={logout} className="text-gray-400 hover:text-white">
                    Logout
                </button>
            </div>
        </div>
    );
}
