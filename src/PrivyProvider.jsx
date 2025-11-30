import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

    return (
        <PrivyProviderBase
            // Use your App ID
            appId="cmils4y2e01cak10b4nf2n7qn"
            
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only',
                },
                // Allow Email + External Wallets (Phantom)
                loginMethods: ['email', 'wallet'], 
                
                embeddedWallets: {
                    // 🛑 PERMANENTLY OFF. 
                    // Privy will NOT create wallets. We will do it ourselves.
                    createOnLogin: 'off', 
                },
                
                solanaClusters: [{ name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' }],
                externalWallets: { solana: { connectors: solanaConnectors } },
            }}
        >
            {children}
        </PrivyProviderBase>
    );
}
