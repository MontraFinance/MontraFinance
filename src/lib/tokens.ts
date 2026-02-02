export interface BaseToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Curated list of popular ERC-20 tokens on Base chain.
 * Used for automatic portfolio scanning.
 */
export const BASE_TOKENS: BaseToken[] = [
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    symbol: "USDbC",
    name: "USD Base Coin",
    decimals: 6,
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
  },
  {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    decimals: 18,
  },
  {
    address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
    symbol: "wstETH",
    name: "Wrapped Lido Staked ETH",
    decimals: 18,
  },
  {
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    symbol: "AERO",
    name: "Aerodrome Finance",
    decimals: 18,
  },
  {
    address: "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b",
    symbol: "tBTC",
    name: "tBTC v2",
    decimals: 18,
  },
];

/**
 * Returns the full token list including the MONTRA burn token from env if configured.
 */
export function getAllBaseTokens(): BaseToken[] {
  const tokens = [...BASE_TOKENS];

  const burnAddress = process.env.BURN_TOKEN_ADDRESS;
  const burnDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);

  if (burnAddress && !tokens.some((t) => t.address.toLowerCase() === burnAddress.toLowerCase())) {
    tokens.push({
      address: burnAddress,
      symbol: "MONTRA",
      name: "Montra Token",
      decimals: burnDecimals,
    });
  }

  return tokens;
}
