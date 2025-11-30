import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// 1. Get the Solana connectors (Phantom, Solflare, etc.)
const solanaConnectors = toSolanaWalletConnectors();

export function PrivyProvider({ children }) {
    return (
        <PrivyProviderBase
            appId="cmils4y2e01cak10b4nf2n7qn"
            config={{
                // 2. UI: Force the interface to look like a Solana app
                appearance: {
                    theme: 'dark',
                    accentColor: '#4ade80',
                    walletChainType: 'solana-only', 
                    showWalletLoginFirst: true,
                },
                
                // 3. Login Options: Allow Email AND External Wallets
                loginMethods: ['email', 'wallet'], 

                // 4. Embedded Wallets (Crucial Fix):
                // We turn OFF auto-creation to stop the "EVM Bias" bug.
                // We will create the wallet manually in the next file.
                embeddedWallets: {
                    createOnLogin: 'off', 
                    requireUserPasswordOnCreate: false,
                },

                // 5. Network: Define Solana Mainnet
                solanaClusters: [{ 
                    name: 'mainnet-beta', 
                    rpcUrl: 'https://api.mainnet-beta.solana.com' 
                }],

                // 6. External Wallets (Matches your Docs Link):
                // This connects Phantom/Solflare to Privy.
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
