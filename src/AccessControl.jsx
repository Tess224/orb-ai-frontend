import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';

// These are the access codes you'll give to testers
// Each code has a name (to identify the person) and a daily limit
const ACCESS_CODES = {
    'ADMIN-2025': { name: 'Admin (You)', limit: 999 },
    'ALPHA-TEST-1': { name: 'Alpha Tester 1', limit: 10 },
    'ALPHA-TEST-2': { name: 'Alpha Tester 2', limit: 10 },
    'BETA-TEST-1': { name: 'Beta Tester 1', limit: 5 },
    // Add more codes here as you give them to people
};

/**
 * AccessControl Component
 * 
 * This component wraps your entire app and only shows it to people
 * who have a valid access code. Think of it like a bouncer at a club
 * checking IDs before letting people in.
 * 
 * How it works:
 * 1. User visits your site
 * 2. They see an access code entry screen
 * 3. They enter a code you gave them
 * 4. If the code is valid, they get access to your terminal
 * 5. The code is saved in their browser so they don't need to enter it again
 */
export function AccessControl({ children }) {
    // State to track if the user has entered a valid code
    const [isAuthorized, setIsAuthorized] = useState(false);
    
    // State to store which code they used
    const [accessCode, setAccessCode] = useState('');
    
    // State to store information about the user (name and limit)
    const [userInfo, setUserInfo] = useState(null);
    
    // State for the input field where they type the code
    const [inputValue, setInputValue] = useState('');
    
    // State to show error messages
    const [error, setError] = useState('');

    /**
     * When the component first loads, check if the user already
     * entered a valid code before (saved in browser storage).
     * 
     * This is like checking if someone already has a wristband
     * before asking them for ID again.
     */
    useEffect(() => {
        const savedCode = localStorage.getItem('orb_access_code');
        
        if (savedCode && ACCESS_CODES[savedCode]) {
            // They have a valid saved code, let them in
            setAccessCode(savedCode);
            setUserInfo(ACCESS_CODES[savedCode]);
            setIsAuthorized(true);
        }
    }, []); // Empty array means this only runs once when component loads

    /**
     * Handle the form submission when user enters an access code
     */
    const handleSubmit = (e) => {
        e.preventDefault(); // Prevent page reload
        
        // Clean up the input (remove spaces, make uppercase)
        const code = inputValue.trim().toUpperCase();
        
        // Check if this code exists in our ACCESS_CODES object
        if (ACCESS_CODES[code]) {
            // Valid code! Save it and grant access
            localStorage.setItem('orb_access_code', code);
            setAccessCode(code);
            setUserInfo(ACCESS_CODES[code]);
            setIsAuthorized(true);
            setError(''); // Clear any errors
        } else {
            // Invalid code, show error
            setError('Invalid access code. Please check and try again.');
            setInputValue(''); // Clear the input
        }
    };

    /**
     * Handle logout - clears the saved code and kicks them back
     * to the access code entry screen
     */
    const handleLogout = () => {
        localStorage.removeItem('orb_access_code');
        setIsAuthorized(false);
        setAccessCode('');
        setUserInfo(null);
        setInputValue('');
        setError('');
    };

    /**
     * If user hasn't entered a valid code yet, show the
     * access code entry screen instead of your app
     */
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="border-2 border-green-400 rounded-lg p-8 bg-black/50 backdrop-blur">
                        {/* Logo and Title */}
                        <div className="flex items-center gap-3 mb-6">
                            <Brain className="w-10 h-10 text-purple-400" />
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                                    ORB TERMINAL
                                </h1>
                                <p className="text-xs text-green-400/60">
                                    Onchain Research & Behavior Analytics
                                </p>
                            </div>
                        </div>
                        
                        {/* Access Required Message */}
                        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded p-3 mb-6">
                            <p className="text-yellow-400 text-sm">
                                🔒 This terminal requires an access code
                            </p>
                        </div>

                        {/* Access Code Entry Form */}
                        <form onSubmit={handleSubmit}>
                            <label className="block text-sm text-green-400 mb-2 font-bold">
                                Enter Your Access Code
                            </label>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="XXXX-XXXX-X"
                                className="w-full bg-black border-2 border-green-400/30 rounded px-4 py-3 text-green-400 placeholder-green-400/30 focus:border-green-400 focus:outline-none mb-4 font-mono uppercase"
                                autoFocus
                            />
                            
                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 text-red-400 text-sm">
                                    ⚠️ {error}
                                </div>
                            )}
                            
                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full bg-green-400 text-black font-bold py-3 rounded hover:bg-green-300 transition-all shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                            >
                                ACCESS TERMINAL
                            </button>
                        </form>
                        
                        {/* Help Text */}
                        <div className="mt-6 pt-6 border-t border-green-400/20">
                            <p className="text-xs text-green-400/60 text-center">
                                Need an access code? Contact the administrator
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /**
     * If user IS authorized (has valid code), show your actual app
     * with a small info bar at the top showing who they are
     */
    return (
        <div>
            {/* Info bar at the top showing user info and logout */}
            <div className="bg-black/90 border-b border-green-400/30 px-4 py-2 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="text-xs">
                        <span className="text-green-400/60">Access Code:</span>{' '}
                        <span className="text-green-400 font-bold font-mono">{accessCode}</span>
                    </div>
                    <div className="text-xs">
                        <span className="text-green-400/60">User:</span>{' '}
                        <span className="text-cyan-400 font-bold">{userInfo.name}</span>
                    </div>
                    <div className="text-xs">
                        <span className="text-green-400/60">Daily Limit:</span>{' '}
                        <span className="text-yellow-400 font-bold">{userInfo.limit} analyses</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-xs text-red-400 hover:text-red-300 transition px-3 py-1 border border-red-400/30 rounded"
                >
                    LOGOUT
                </button>
            </div>
            
            {/* This is where your actual app (Terminal, Marketplace) appears */}
            {children}
        </div>
    );
}