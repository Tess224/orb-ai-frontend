import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

    return (
        <PrivyProviderBase
            // ⬇️ PASTE YOUR NEW APP ID HERE ⬇️
            appId="cmiloes5y05x2jo0cs4hxx7du"
            
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only',
                },
                loginMethods: ['email', 'google'],
                embeddedWallets: {
                    // We trust the dashboard to auto-create now
                    requireUserPasswordOnCreate: false,
                },
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
