import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

    return (
        <PrivyProviderBase
            // Use your "Orb Solana V2" App ID
            appId="cmils4y2e01cak10b4nf2n7qn"
            
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only',
                },
                loginMethods: ['email', 'google'],
                
                // 👇 THIS IS THE FIX 👇
                embeddedWallets: {
                    // 1. Explicitly DISABLE Ethereum creation
                    ethereum: {
                        createOnLogin: 'off', 
                    },
                    // 2. Explicitly ENABLE Solana creation
                    solana: {
                        createOnLogin: 'users-without-wallets',
                    },
                    requireUserPasswordOnCreate: false,
                },
                // 👆 END OF FIX 👆

                solanaClusters: [{ 
                    name: 'mainnet-beta', 
                    rpcUrl: 'https://api.mainnet-beta.solana.com' 
                }],
                externalWallets: { 
                    solana: { connectors: solanaConnectors } 
                },
            }}
        >
            {children}
        </PrivyProviderBase>
    );
}
