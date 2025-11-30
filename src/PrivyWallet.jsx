import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Keypair } from '@solana/web3.js';
import { Copy, RefreshCw, LogOut, User, Trash2 } from 'lucide-react';
import bs58 from 'bs58'; // Ensure you have this, or use the helper below

// Use your RPC
const CONNECTION = new Connection('https://orbonsolana.up.railway.app/api/proxy/helius');

export function PrivyWallet() {
    const { authenticated, login, logout, user } = usePrivy();
    const [balance, setBalance] = useState(0);
    const [localWallet, setLocalWallet] = useState(null);

    // 1. Load or Create Wallet on Mount
    useEffect(() => {
        if (authenticated) {
            const savedKey = localStorage.getItem('orb_solana_key');
            
            if (savedKey) {
                // Load existing
                try {
                    const secretKey = Uint8Array.from(JSON.parse(savedKey));
                    const keypair = Keypair.fromSecretKey(secretKey);
                    setLocalWallet(keypair);
                } catch (e) {
                    console.error("Key error", e);
                }
            } else {
                // Create NEW Solana Wallet (Client Side)
                const keypair = Keypair.generate();
                const secretKey = Array.from(keypair.secretKey);
                localStorage.setItem('orb_solana_key', JSON.stringify(secretKey));
                setLocalWallet(keypair);
            }
        }
    }, [authenticated]);

    // 2. Fetch Balance
    useEffect(() => {
        if (localWallet?.publicKey) {
            const fetch = async () => {
                try {
                    const bal = await CONNECTION.getBalance(localWallet.publicKey);
                    setBalance(bal / LAMPORTS_PER_SOL);
                } catch(e) { setBalance(0); }
            };
            fetch();
            // Refresh every 10s
            const interval = setInterval(fetch, 10000);
            return () => clearInterval(interval);
        }
    }, [localWallet]);

    const copyAddress = () => {
        if (localWallet) {
            navigator.clipboard.writeText(localWallet.publicKey.toString());
            alert("Address Copied!");
        }
    };

    const copyPrivateKey = () => {
        if (localWallet) {
            // Encode to Base58 for easy import into Phantom
            // Note: If 'bs58' is not installed, install it or remove this function
            // npm install bs58
            try {
                // Fallback if bs58 isn't available: show JSON
                const key = bs58.encode(localWallet.secretKey);
                navigator.clipboard.writeText(key);
                alert("Private Key Copied! Import this into Phantom.");
            } catch (e) {
                alert("Please install 'bs58' to export keys nicely.");
            }
        }
    };
    
    // Reset Wallet (Dangerous!)
    const resetWallet = () => {
        if (confirm("Create a new wallet? This deletes the current one.")) {
            localStorage.removeItem('orb_solana_key');
            setLocalWallet(null);
            // Effect will re-run and create new one
        }
    };

    if (!authenticated) {
        return (
            <button onClick={login} className="flex items-center gap-2 px-4 py-2 bg-green-400 text-black font-bold rounded shadow-[0_0_10px_#4ade80]">
                <User className="w-4 h-4" /> LOGIN TO TRADE
            </button>
        );
    }

    if (!localWallet) {
        return <div className="text-green-400">Generating secure wallet...</div>;
    }

    return (
        <div className="flex flex-col items-end gap-2">
            {/* Main Wallet Bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-green-400/60 font-bold">BALANCE</span>
                    <span className="text-green-400 font-bold font-mono">{balance.toFixed(4)} SOL</span>
                </div>
                <div className="h-8 w-[1px] bg-green-400/30"></div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-cyan-400 font-mono">
                        {localWallet.publicKey.toString().slice(0, 4)}...{localWallet.publicKey.toString().slice(-4)}
                    </span>
                    <button onClick={copyAddress} title="Copy Address">
                        <Copy className="w-3 h-3 text-cyan-400/60 hover:text-cyan-400" />
                    </button>
                </div>
            </div>

            {/* Wallet Actions */}
            <div className="flex gap-2 text-[10px]">
                 <button onClick={copyPrivateKey} className="text-yellow-400 hover:underline">
                    Export Key
                </button>
                <button onClick={resetWallet} className="text-red-400 hover:underline">
                    Reset Wallet
                </button>
                <button onClick={logout} className="text-gray-400 hover:underline">
                    Logout
                </button>
            </div>
        </div>
    );
}
