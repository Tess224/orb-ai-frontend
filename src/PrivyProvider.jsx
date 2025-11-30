import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

/**
 * This component wraps your entire application and provides Privy's
 * authentication and wallet functionality to all child components.
 */
export function PrivyProvider({ children }) {
    // Solana wallet connectors for external wallets (Phantom, Solflare, etc)
    const solanaConnectors = toSolanaWalletConnectors({
        // Optional: specific configuration for connectors
        shouldAutoConnect: true,
    });

    return (
        <PrivyProviderBase
            appId="cmil941rp018sl20c3inef3pb"
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    // This ensures the UI is optimized for Solana users
                    walletChainType: 'solana-only', 
                },

                loginMethods: ['email', 'google'],

                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                    requireUserPasswordOnCreate: false,
                },
                
                // -----------------------------------------------------------
                // ❌ REMOVED: defaultChain: 'solana' (This caused the crash)
                // -----------------------------------------------------------

                // ✅ ADDED: Correct Solana configuration
                // This tells Privy which Solana networks you support
                solanaClusters: [
                    {
                        name: 'mainnet-beta', 
                        rpcUrl: 'https://api.mainnet-beta.solana.com'
                    }
                ],

                // Support for external Solana wallets (Phantom, etc.)
                externalWallets: { 
                    solana: { 
                        connectors: solanaConnectors 
                    } 
                },
            }}
        >
            {children}
        </PrivyProviderBase>
    );
}
