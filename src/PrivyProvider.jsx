import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

    return (
        <PrivyProviderBase
            // Use your NEW App ID
            appId="cmils4y2e01cak10b4nf2n7qn"
            
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only',
                },
                loginMethods: ['email', 'google'],
                embeddedWallets: {
                    // 🛑 THIS IS THE FIX 🛑
                    // We turn this OFF so no Ethereum wallet is auto-created.
                    // We will create the Solana wallet manually in the next file.
                    createOnLogin: 'off', 
                    requireUserPasswordOnCreate: false,
                },
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
