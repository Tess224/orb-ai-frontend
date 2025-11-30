import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';

/**
 * This component wraps your entire application and provides Privy's
 * authentication and wallet functionality to all child components.
 * 
 * Think of this as the "power supply" for your authentication system.
 * Once your app is wrapped in this provider, any component can access
 * user authentication state and wallet functionality through Privy's hooks.
 */
export function PrivyProvider({ children }) {
    return (
        <PrivyProviderBase
            // Your App ID from the Privy dashboard
            // Replace this with your actual App ID after you create your Privy account
            appId="cmil941rp018sl20c3inef3pb"
            
            // Configuration for which authentication methods to offer users
            config={{
                // Appearance customization to match your terminal's aesthetic
                appearance: {
                    // Use your terminal's dark theme
                    theme: 'dark',
                    
                    // Customize the accent color to match your green terminal theme
                    accentColor: '#4ade80', // This is green-400 from Tailwind
                    
                    // Optional: Add your logo to the login modal
                    // logo: 'https://your-domain.com/logo.png',
                },
                
                // Configure which login methods are available to users
                loginMethods: ['email', 'google'],
                
                // Embedded wallet configuration for Solana
                embeddedWallets: {
                    // Automatically create a Solana wallet when user authenticates
                    createOnLogin: 'users-without-wallets',
                    
                    // Require users to set up a recovery method for their wallet
                    // This could be email, phone, or passkey depending on what you enable
                    requireUserPasswordOnCreate: false,
                },
                
                // Solana-specific configuration
                defaultChain: 'solana',
            }}
        >
            {children}
        </PrivyProviderBase>
    );
}

/**
 * IMPORTANT CONFIGURATION NOTES:
 * 
 * 1. APP ID: You must replace YOUR_PRIVY_APP_ID_HERE with your actual App ID
 *    from the Privy dashboard. Without this, authentication will not work.
 * 
 * 2. LOGIN METHODS: The loginMethods array controls what authentication options
 *    users see. Start with ['email', 'google'] and add more later if needed.
 *    Available options: 'email', 'sms', 'google', 'twitter', 'discord', 'github'
 * 
 * 3. EMBEDDED WALLETS: The createOnLogin setting ensures every authenticated user
 *    automatically gets a Solana wallet. This happens transparently without the
 *    user needing to understand wallet concepts.
 * 
 * 4. APPEARANCE: The accent color and theme should match your terminal's design.
 *    The color value '#4ade80' matches the green you use throughout your UI.
 * 
 * 5. RECOVERY: Setting requireUserPasswordOnCreate to false means users won't be
 *    forced to set up additional recovery methods immediately. They can do this
 *    later from their account settings if desired.
 */