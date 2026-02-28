/**
 * OnchainKit + Wagmi providers for Base identity, swap, and transaction components.
 *
 * Split into two parts so OnchainKitProvider can read the app's theme:
 * - WagmiProviderWrapper: outermost, provides wagmi config
 * - OnchainKitProviderWrapper: inside ThemeProvider, syncs light/dark mode
 */
import type { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { wagmiConfig } from '@/lib/wagmi';
import { useTheme } from '@/contexts/ThemeContext';

/** Outermost — provides wagmi config (no theme dependency) */
export function WagmiProviderWrapper({ children }: { children: ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}

/** Inside ThemeProvider — reads theme for OnchainKit light/dark sync */
export function OnchainKitProviderWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <OnchainKitProvider
      apiKey={import.meta.env.VITE_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{ appearance: { mode: theme } }}
    >
      {children}
    </OnchainKitProvider>
  );
}
