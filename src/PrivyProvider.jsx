import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function PrivyProvider({ children }) {
    const solanaConnectors = toSolanaWalletConnectors({
        shouldAutoConnect: true,
    });

    return (
        <PrivyProviderBase
            appId="cmil941rp018sl20c3inef3pb"
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only', 
                },
                loginMethods: ['email', 'google'],
                embeddedWallets: {
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
