import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Copy, RefreshCw, LogOut, User } from 'lucide-react';

const CONNECTION = new Connection('https://orbonsolana.up.railway.app/api/proxy/helius');

export function PrivyWallet() {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useWallets();

    const [balance, setBalance] = useState(0);
    
    // Find the Solana wallet
    const solanaWallet = wallets.find((w) => w.walletClientType === 'privy' && w.chainType === 'solana');

    useEffect(() => {
        if (solanaWallet?.address) {
            const fetch = async () => {
                try {
                    const pk = new PublicKey(solanaWallet.address);
                    const bal = await CONNECTION.getBalance(pk);
                    setBalance(bal / LAMPORTS_PER_SOL);
                } catch(e) { setBalance(0); }
            };
            fetch();
        }
    }, [solanaWallet?.address]);

    const formatAddress = (addr) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

    if (!ready) return <div className="p-4 text-green-400">Loading auth...</div>;
    
    if (!authenticated) {
        return (
            <button onClick={login} className="px-4 py-2 bg-green-400 text-black font-bold rounded">
                CONNECT WALLET
            </button>
        );
    }

    if (!solanaWallet?.address) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded">
                <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400">Generating Solana wallet...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded">
            <span className="text-green-400 font-bold font-mono">{balance.toFixed(4)} SOL</span>
            <div className="h-4 w-[1px] bg-green-400/30"></div>
            <span className="text-xs text-cyan-400 font-mono">{formatAddress(solanaWallet.address)}</span>
            <button onClick={logout} className="ml-2 text-red-400"><LogOut className="w-3 h-3" /></button>
        </div>
    );
}
