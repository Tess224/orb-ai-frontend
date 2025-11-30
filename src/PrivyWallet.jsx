import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { RefreshCw, LogOut, User, Wallet } from 'lucide-react';

const CONNECTION = new Connection('https://orbonsolana.up.railway.app/api/proxy/helius');

export function PrivyWallet() {
    const { ready, authenticated, login, logout, createWallet } = usePrivy();
    const { wallets } = useWallets();
    const [balance, setBalance] = useState(0);
    const [status, setStatus] = useState('');

    // Find whichever wallet is active (Embedded SOL OR Phantom SOL)
    const activeWallet = wallets.find((w) => w.chainType === 'solana');

    // ⚡ MANUAL CREATION SCRIPT (For Email Users)
    useEffect(() => {
        // If logged in, but NO wallet exists...
        if (ready && authenticated && wallets.length === 0) {
            setStatus('Creating Solana wallet...');
            
            // Force create Solana wallet
            createWallet({ chainType: 'solana' })
                .catch((err) => {
                    console.error("Creation failed:", err);
                    setStatus('Error creating wallet');
                });
        }
    }, [ready, authenticated, wallets, createWallet]);

    // Balance Fetcher
    useEffect(() => {
        if (activeWallet?.address) {
            const fetch = async () => {
                try {
                    const pk = new PublicKey(activeWallet.address);
                    const bal = await CONNECTION.getBalance(pk);
                    setBalance(bal / LAMPORTS_PER_SOL);
                } catch(e) { setBalance(0); }
            };
            fetch();
        }
    }, [activeWallet?.address]);

    if (!ready) return <div className="text-green-400 text-xs">Loading...</div>;

    if (!authenticated) {
        return (
            <button onClick={login} className="flex items-center gap-2 px-4 py-2 bg-green-400 text-black font-bold rounded">
                <User className="w-4 h-4" /> LOGIN / CONNECT
            </button>
        );
    }

    // Creating State (Only for Email users)
    if (!activeWallet?.address) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded">
                <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400">{status || "Setting up Solana..."}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded">
            <span className="text-green-400 font-bold font-mono">{balance.toFixed(4)} SOL</span>
            <div className="h-4 w-[1px] bg-green-400/30"></div>
            <span className="text-xs text-cyan-400 font-mono">
                {activeWallet.address.slice(0, 4)}...{activeWallet.address.slice(-4)}
            </span>
            <button onClick={logout} className="ml-2 text-red-400"><LogOut className="w-3 h-3" /></button>
        </div>
    );
}
