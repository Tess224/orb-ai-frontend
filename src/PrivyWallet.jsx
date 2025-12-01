import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Keypair } from '@solana/web3.js';
import { Copy, RefreshCw, LogOut, User, ExternalLink, Eye, EyeOff, Import, Plus, X } from 'lucide-react';
import bs58 from 'bs58';

// 🔒 SECURE CONNECTION
// Vite pulls this key from your Vercel Environment Variables
const API_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;

export function PrivyWallet() {
    const { authenticated, login, logout } = usePrivy();
    const [balance, setBalance] = useState(0);
    const [localWallet, setLocalWallet] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [view, setView] = useState('home'); 
    const [importInput, setImportInput] = useState('');
    const [debugLogs, setDebugLogs] = useState([]); 
// ADD THIS FUNCTION HERE
    const addLog = (message) => {
        setDebugLogs(prev => [...prev.slice(-10), message]);
    };

    // 1. Load/Create Wallet
    useEffect(() => {
        if (authenticated) {
            const savedKey = localStorage.getItem('orb_solana_key');
            if (savedKey) {
                try {
                    const secretKey = Uint8Array.from(JSON.parse(savedKey));
                    setLocalWallet(Keypair.fromSecretKey(secretKey));
                } catch (e) { console.error(e); }
            } else {
                const keypair = Keypair.generate();
                localStorage.setItem('orb_solana_key', JSON.stringify(Array.from(keypair.secretKey)));
                setLocalWallet(keypair);
            }
        }
    }, [authenticated]);

      const fetchBalance = useCallback(async () => {
    addLog("=== BALANCE FETCH START ===");
    
    if (!localWallet?.publicKey) {
        addLog("❌ No wallet public key available");
        return;
    }

    addLog("✅ Wallet exists");
    addLog(`📍 Wallet address: ${localWallet.publicKey.toString()}`);
    addLog(`🔑 API_KEY exists? ${!!API_KEY}`);
    addLog(`🔑 API_KEY value (first 10): ${API_KEY ? API_KEY.substring(0, 10) + "..." : "UNDEFINED"}`);
    addLog(`🔗 RPC: ${RPC_ENDPOINT}`);

    if (!API_KEY) {
        addLog("❌ CRITICAL: API_KEY is undefined");
        setErrorMsg("Missing API Key");
        return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
        addLog("🔌 Creating connection...");
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        addLog("✅ Connection created");
        
        addLog("📡 Calling getBalance...");
        const bal = await connection.getBalance(localWallet.publicKey);
        
        addLog(`✅ Balance received!`);
        addLog(`💰 Raw (lamports): ${bal}`);
        addLog(`💰 Converted (SOL): ${bal / LAMPORTS_PER_SOL}`);
        
        setBalance(bal / LAMPORTS_PER_SOL);
        addLog("=== SUCCESS ===");
    } catch(e) { 
        addLog(`❌ ERROR: ${e.message}`);
        console.error("Fetch failed:", e);
        setErrorMsg(`Connection Error: ${e.message}`);
        addLog("=== FAILED ===");
    } finally {
        setLoading(false);
    }
}, [localWallet]);

    useEffect(() => {
        if (localWallet) fetchBalance();
    }, [localWallet, fetchBalance]);

    // PASTE THIS BEFORE THE RETURN STATEMENT
    const handleImport = () => {
        try {
            const text = importInput.trim();
            let secretKey;

            // Handle JSON Array format (e.g. [12, 44, ...])
            if (text.startsWith('[') && text.endsWith(']')) {
                secretKey = Uint8Array.from(JSON.parse(text));
            } else {
                // Handle Base58 format (Phantom/Solflare standard)
                secretKey = bs58.decode(text);
            }

            // Verify Key Length (Solana keys must be 64 bytes)
            if (secretKey.length !== 64) throw new Error("Invalid Key Length");

            const keypair = Keypair.fromSecretKey(secretKey);
            
            // Save and Set
            localStorage.setItem('orb_solana_key', bs58.encode(keypair.secretKey));
            setLocalWallet(keypair);
            setBalance(0); // Reset balance until fetch happens
            setView('home'); // Close import screen
            setImportInput('');
            addLog("✅ Wallet Imported Successfully");
        } catch (e) {
            alert("Invalid Private Key format. Please check and try again.");
            addLog(`❌ Import Error: ${e.message}`);
        }
    };

    // ... (Keep existing Helper Functions) ...
    const copyAddress = () => navigator.clipboard.writeText(localWallet?.publicKey.toString()) && alert("Copied!");
    
    const copyPrivateKey = () => {
        if (!localWallet) return;
        try {
            navigator.clipboard.writeText(bs58.encode(localWallet.secretKey));
            alert("Key Copied!");
        } catch (e) {
            navigator.clipboard.writeText(`[${localWallet.secretKey.toString()}]`);
            alert("Key Copied! (Raw Format)");
        }
    };

    const resetWallet = () => {
        if (confirm("Delete wallet? Ensure you backed up the key!")) {
            localStorage.removeItem('orb_solana_key');
            window.location.reload(); 
        }
    };

    const openSolscan = () => {
        if (localWallet) window.open(`https://solscan.io/account/${localWallet.publicKey.toString()}`, '_blank');
    };

    if (!authenticated) return <button onClick={login} className="text-green-400 border border-green-400 px-4 py-2 rounded">LOGIN</button>;
    if (!localWallet) return <div className="text-green-400">Loading...</div>;

    return (
        <div className="flex flex-col items-end gap-2">
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
                    <button onClick={copyAddress}><Copy className="w-3 h-3 text-cyan-400" /></button>
                    <button onClick={fetchBalance} disabled={loading}>
                        <RefreshCw className={`w-3 h-3 text-green-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={openSolscan}><ExternalLink className="w-3 h-3 text-gray-400" /></button>
                </div>
            </div>
            
            {errorMsg && <div className="text-[10px] text-red-400">{errorMsg}</div>}

            <div className="flex gap-3 text-[10px]">
                <button onClick={() => setShowKey(!showKey)} className="text-yellow-400">{showKey ? "Hide" : "Key"}</button>
                {showKey && <button onClick={copyPrivateKey} className="text-yellow-400 underline">Copy</button>}
                <button onClick={resetWallet} className="text-red-400">Reset</button>
                <button onClick={logout} className="text-gray-400">Logout</button>
            </div>
           {/* ADD THE DEBUG PANEL HERE - RIGHT BEFORE THE CLOSING </div> */}
            {debugLogs.length > 0 && (
                <div className="mt-2 p-3 bg-black/95 border-2 border-red-400 rounded text-[10px] text-red-400 max-h-60 overflow-y-auto w-96">
                    <div className="font-bold mb-2 text-yellow-400">🔍 DEBUG LOGS:</div>
                    {debugLogs.map((log, i) => (
                        <div key={i} className="font-mono mb-1 border-b border-red-400/20 pb-1">
                            {log}
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
