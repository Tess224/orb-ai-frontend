import { useState, useEffect, useCallback } from 'react';
import { Connection, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { Copy, RefreshCw, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';
import bs58 from 'bs58';

const API_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;

/**
 * SimpleWallet Component
 * 
 * A straightforward wallet component that:
 * 1. Creates a new Solana wallet when first loaded
 * 2. Saves it to browser storage so it persists
 * 3. Shows the balance
 * 4. Lets users export/import wallets
 * 
 * No Privy, no authentication, just a simple wallet.
 */
export function SimpleWallet() {
    const [wallet, setWallet] = useState(null);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importKey, setImportKey] = useState('');

    /**
     * When component loads, check if a wallet already exists
     * in browser storage. If yes, load it. If no, create new one.
     */
    useEffect(() => {
        const savedKey = localStorage.getItem('orb_solana_key');
        
        if (savedKey) {
            // Wallet exists, load it
            try {
                const secretKey = Uint8Array.from(JSON.parse(savedKey));
                const keypair = Keypair.fromSecretKey(secretKey);
                setWallet(keypair);
            } catch (e) {
                console.error('Failed to load wallet:', e);
                // If loading fails, create new wallet
                createNewWallet();
            }
        } else {
            // No wallet exists, create new one
            createNewWallet();
        }
    }, []);

    /**
     * Create a brand new wallet and save it
     */
    const createNewWallet = () => {
        const keypair = Keypair.generate();
        localStorage.setItem('orb_solana_key', JSON.stringify(Array.from(keypair.secretKey)));
        setWallet(keypair);
    };

    /**
     * Fetch the SOL balance for the current wallet
     */
    const fetchBalance = useCallback(async () => {
        if (!wallet?.publicKey || !API_KEY) return;
        
        setLoading(true);
        try {
            const connection = new Connection(RPC_ENDPOINT, 'confirmed');
            const bal = await connection.getBalance(wallet.publicKey);
            setBalance(bal / LAMPORTS_PER_SOL);
        } catch (e) {
            console.error('Balance fetch failed:', e);
        } finally {
            setLoading(false);
        }
    }, [wallet]);

    /**
     * Automatically fetch balance when wallet loads
     */
    useEffect(() => {
        if (wallet) {
            fetchBalance();
        }
    }, [wallet, fetchBalance]);

    /**
     * Copy wallet address to clipboard
     */
    const copyAddress = () => {
        if (wallet) {
            navigator.clipboard.writeText(wallet.publicKey.toString());
            alert('Address copied!');
        }
    };

    /**
     * Copy private key to clipboard
     */
    const copyPrivateKey = () => {
        if (!wallet) return;
        try {
            const privateKey = bs58.encode(wallet.secretKey);
            navigator.clipboard.writeText(privateKey);
            alert('Private key copied! Keep this secret and safe!');
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    /**
     * Import a wallet from a private key
     */
    const importWallet = () => {
        if (!importKey.trim()) {
            alert('Please enter a private key');
            return;
        }
        
        try {
            let secretKey;
            
            // Try to decode as base58 first (standard format)
            try {
                secretKey = bs58.decode(importKey.trim());
            } catch {
                // If that fails, try parsing as JSON array
                secretKey = Uint8Array.from(JSON.parse(importKey.trim()));
            }
            
            const keypair = Keypair.fromSecretKey(secretKey);
            
            // Save to localStorage
            localStorage.setItem('orb_solana_key', JSON.stringify(Array.from(keypair.secretKey)));
            
            // Update state
            setWallet(keypair);
            setShowImport(false);
            setImportKey('');
            
            alert(`Wallet imported successfully!`);
        } catch (e) {
            alert(`Failed to import wallet: ${e.message}`);
        }
    };

    /**
     * Delete the current wallet (with confirmation)
     */
    const deleteWallet = () => {
        if (confirm('⚠️ WARNING: This will delete your wallet! Make sure you have backed up your private key. Continue?')) {
            localStorage.removeItem('orb_solana_key');
            createNewWallet();
        }
    };

    /**
     * Open Solscan to view wallet on blockchain explorer
     */
    const openSolscan = () => {
        if (wallet) {
            window.open(`https://solscan.io/account/${wallet.publicKey.toString()}`, '_blank');
        }
    };

    // If wallet isn't loaded yet, show loading
    if (!wallet) {
        return <div className="text-green-400 text-sm">Loading wallet...</div>;
    }

    return (
        <div className="flex flex-col items-end gap-2">
            {/* Main wallet display */}
            <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border border-green-400/50 rounded">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-green-400/60 font-bold">BALANCE</span>
                    <span className="text-green-400 font-bold font-mono">
                        {balance.toFixed(4)} SOL
                    </span>
                </div>
                
                <div className="h-8 w-[1px] bg-green-400/30"></div>
                
                <div className="flex items-center gap-2">
                    <span className="text-xs text-cyan-400 font-mono">
                        {wallet.publicKey.toString().slice(0, 4)}...
                        {wallet.publicKey.toString().slice(-4)}
                    </span>
                    <button onClick={copyAddress} title="Copy address">
                        <Copy className="w-3 h-3 text-cyan-400 hover:text-cyan-300" />
                    </button>
                    <button onClick={fetchBalance} disabled={loading} title="Refresh balance">
                        <RefreshCw className={`w-3 h-3 text-green-400 hover:text-green-300 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={openSolscan} title="View on Solscan">
                        <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-300" />
                    </button>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 text-[10px]">
                <button 
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-yellow-400 hover:text-yellow-300"
                >
                    {showPrivateKey ? 'Hide Key' : 'Show Key'}
                </button>
                {showPrivateKey && (
                    <button 
                        onClick={copyPrivateKey}
                        className="text-yellow-400 hover:text-yellow-300 underline"
                    >
                        Copy Key
                    </button>
                )}
                <button 
                    onClick={() => setShowImport(true)}
                    className="text-cyan-400 hover:text-cyan-300"
                >
                    Import
                </button>
                <button 
                    onClick={deleteWallet}
                    className="text-red-400 hover:text-red-300"
                >
                    Delete
                </button>
            </div>

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-black border-2 border-cyan-400 rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-cyan-400 font-bold mb-4">Import Wallet</h3>
                        <p className="text-xs text-green-400/60 mb-4">
                            Paste your private key (base58 format or JSON array)
                        </p>
                        <textarea
                            value={importKey}
                            onChange={(e) => setImportKey(e.target.value)}
                            placeholder="Paste private key here..."
                            className="w-full bg-black border border-cyan-400/50 rounded p-3 text-cyan-400 text-xs font-mono mb-4 min-h-[100px]"
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={importWallet}
                                className="flex-1 bg-cyan-400 text-black px-4 py-2 rounded font-bold hover:bg-cyan-300"
                            >
                                Import
                            </button>
                            <button 
                                onClick={() => { setShowImport(false); setImportKey(''); }}
                                className="flex-1 border border-cyan-400 text-cyan-400 px-4 py-2 rounded hover:bg-cyan-400/10"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}