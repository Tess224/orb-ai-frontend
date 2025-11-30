import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    // Enable external wallets like Phantom
    const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

    return (
        <PrivyProviderBase
            // 🚨 PASTE YOUR NEW APP ID HERE 🚨
            appId="cmils4y2e01cak10b4nf2n7qn"
            
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only',
                },
                loginMethods: ['email', 'google'],
                embeddedWallets: {
                    // 🛑 DOCS RECOMMENDATION: Turn this OFF to prevent EVM bias
                    createOnLogin: 'off', 
                    requireUserPasswordOnCreate: false,
                },
                // ✅ This configures the app for Solana
                solanaClusters: [
                    {
                        name: 'mainnet-beta', 
                        rpcUrl: 'https://api.mainnet-beta.solana.com'
                    }
                ],
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
