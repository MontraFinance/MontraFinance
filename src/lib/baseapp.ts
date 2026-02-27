/**
 * Base App (Coinbase mobile mini-app) detection utilities.
 * Base App injects a Coinbase Wallet provider into window.ethereum.
 */

/** Detect if running inside Base App WebView (mobile + Coinbase provider). */
export function isBaseAppWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    (!!window.ethereum?.isCoinbaseWallet || !!(window as any).coinbaseWalletExtension) &&
    /Mobile|Android/i.test(ua)
  );
}

/** Check if current route is a /baseapp/* route. */
export function isBaseAppRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/baseapp');
}
