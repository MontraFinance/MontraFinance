/**
 * Live Market Data Service
 * Fetches real-time data from Helsinki VM, Coinglass, and Whale Alert
 * via server-side proxies to avoid CORS and mixed-content issues.
 */

interface HelsinkiFull {
  symbol: string;
  timestamp: string;
  volatility?: {
    current_regime: string;
    volatility_7d_pct: number;
    volatility_30d_pct: number;
    regime_probabilities: { low_vol: number; normal: number; high_vol: number };
    trading_adjustments: { position_size_multiplier: number; stop_loss_atr_mult: number; strategy: string };
  };
  liquidation?: {
    current_price: number;
    open_interest_usd: number;
    long_short_ratio: number;
    funding_rate_pct: number;
    cascade_bias: string;
    cascade_note: string;
    downside_liquidation_zones: Array<{ price: number; distance_pct: number; leverage_trigger: string; risk_level: string }>;
    upside_liquidation_zones: Array<{ price: number; distance_pct: number; leverage_trigger: string; risk_level: string }>;
  };
  smart_money?: {
    top_trader_ls_ratio: number;
    global_ls_ratio: number;
    divergence: number;
    smart_money_bias: string;
    trend: string;
    trend_note: string;
  };
  large_trades?: {
    large_trade_count: number;
    net_flow_usd: number;
    flow_sentiment: string;
    total_buy_volume_usd: number;
    total_sell_volume_usd: number;
  };
  synthesis?: {
    signals: Array<{ factor: string; signal: string; note: string }>;
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    overall_bias: string;
    confidence: number;
  };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHelsinkiData(symbol: string): Promise<HelsinkiFull | null> {
  try {
    const res = await fetchWithTimeout(`/api/proxy/helsinki?path=/quant/full/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?._unavailable) return null;
    return data;
  } catch {
    console.warn(`Helsinki fetch failed for ${symbol}`);
    return null;
  }
}

export async function fetchHelsinkiStatics(): Promise<Record<string, unknown>> {
  const endpoints = [
    { key: "fear_greed", path: "/sentiment/fear-greed" },
    { key: "funding", path: "/derivatives/funding" },
    { key: "dominance", path: "/quant/dominance" },
    { key: "macro", path: "/quant/macro" },
  ];

  const results: Record<string, unknown> = {};

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      try {
        const res = await fetchWithTimeout(`/api/proxy/helsinki?path=${encodeURIComponent(ep.path)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?._unavailable) results[ep.key] = data;
      } catch { /* skip */ }
    })
  );

  return results;
}

export async function fetchWhaleTransactions(): Promise<string> {
  try {
    const since = Math.floor(Date.now() / 1000) - 3600;
    const res = await fetchWithTimeout(
      `/api/proxy/whale-alert?min_value=1000000&start=${since}&limit=5`
    );
    if (!res.ok) return "Whale Alert: unavailable";
    const data = await res.json();
    if (!data.transactions?.length) return "Whale Alert: No major transactions in the last hour.";

    return data.transactions
      .slice(0, 5)
      .map((tx: { symbol: string; amount: number; amount_usd: number; from: { owner_type: string }; to: { owner_type: string } }) => {
        const dir = tx.to.owner_type === "exchange" ? "→ EXCHANGE (sell pressure)" : tx.from.owner_type === "exchange" ? "← EXCHANGE (accumulation)" : "transfer";
        return `${tx.symbol.toUpperCase()}: ${Number(tx.amount).toLocaleString()} ($${Number(tx.amount_usd / 1e6).toFixed(1)}M) ${dir}`;
      })
      .join("\n");
  } catch {
    return "Whale Alert: connection failed";
  }
}

export async function fetchCoinglassFunding(): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `/api/proxy/coinglass?path=/futures/funding-rate&symbol=BTC`
    );
    if (!res.ok) return "";
    const data = await res.json();
    if (data.data) {
      return `Coinglass Funding: ${JSON.stringify(data.data).slice(0, 200)}`;
    }
    return "";
  } catch {
    return "";
  }
}

export function detectSymbols(query: string): string[] {
  const q = query.toUpperCase();
  const symbols: string[] = [];
  if (q.includes("BTC") || q.includes("BITCOIN")) symbols.push("BTC");
  if (q.includes("ETH") || q.includes("ETHEREUM") || q.includes("ETHER")) symbols.push("ETH");
  if (q.includes("SOL") || q.includes("SOLANA")) symbols.push("SOL");
  if (q.includes("XRP") || q.includes("RIPPLE")) symbols.push("XRP");
  if (q.includes("DOGE") || q.includes("DOGECOIN")) symbols.push("DOGE");
  if (q.includes("ADA") || q.includes("CARDANO")) symbols.push("ADA");
  if (q.includes("AVAX") || q.includes("AVALANCHE")) symbols.push("AVAX");
  if (q.includes("LINK") || q.includes("CHAINLINK")) symbols.push("LINK");
  if (q.includes("DOT") || q.includes("POLKADOT")) symbols.push("DOT");
  if (q.includes("MATIC") || q.includes("POLYGON")) symbols.push("MATIC");
  if (q.includes("ARB") || q.includes("ARBITRUM")) symbols.push("ARB");
  if (q.includes("OP") && (q.includes("OPTIMISM") || /\bOP\b/.test(q))) symbols.push("OP");
  if (q.includes("BNB") || q.includes("BINANCE")) symbols.push("BNB");
  if (q.includes("PEPE")) symbols.push("PEPE");
  if (q.includes("WIF")) symbols.push("WIF");
  if (q.includes("SUI")) symbols.push("SUI");

  if (symbols.length === 0) {
    const marketWords = ["market", "analysis", "signal", "cascade", "risk", "portfolio", "position", "setup", "conviction", "trade", "buy", "sell", "long", "short", "invest", "compare", "better", "best", "which", "versus", "vs"];
    if (marketWords.some(w => q.toLowerCase().includes(w))) {
      symbols.push("BTC");
    }
  }

  return symbols;
}

function formatHelsinkiContext(data: HelsinkiFull): string {
  const lines: string[] = [];
  const sym = data.symbol?.replace("USDT", "") || "???";

  lines.push(`${sym}:`);

  if (data.liquidation) {
    const l = data.liquidation;
    const lsDesc = l.long_short_ratio > 1.05 ? "more longs than shorts" : l.long_short_ratio < 0.95 ? "more shorts than longs" : "balanced bets";
    const fundDesc = l.funding_rate_pct > 0.01 ? "bulls paying premium" : l.funding_rate_pct < -0.01 ? "bears paying premium" : "neutral cost";
    lines.push(`Price: $${l.current_price.toLocaleString()} | Market bets: ${lsDesc} | Cost to hold: ${fundDesc}`);
    const nearDown = l.downside_liquidation_zones?.[0];
    const nearUp = l.upside_liquidation_zones?.[0];
    if (nearDown) lines.push(`Support: $${nearDown.price.toLocaleString()} (${nearDown.distance_pct}% below)`);
    if (nearUp) lines.push(`Resistance: $${nearUp.price.toLocaleString()} (${nearUp.distance_pct}% above)`);
  }

  if (data.smart_money) {
    const bias = data.smart_money.smart_money_bias;
    const trend = data.smart_money.trend;
    lines.push(`Whales are: ${bias.toLowerCase()} | Trend: ${trend.toLowerCase()}`);
  }

  if (data.volatility) {
    const vol = data.volatility.current_regime.toLowerCase();
    lines.push(`Market mood: ${vol === "high" ? "wild/choppy" : vol === "low" ? "calm/quiet" : "normal"}`);
  }

  if (data.large_trades) {
    const lt = data.large_trades;
    const dir = lt.flow_sentiment.toLowerCase();
    lines.push(`Big money flow: ${dir === "bullish" ? "buying" : dir === "bearish" ? "selling" : "mixed"}`);
  }

  if (data.synthesis) {
    const s = data.synthesis;
    lines.push(`Signal: ${s.overall_bias.toLowerCase()} (${s.confidence}% sure) — ${s.bullish_count} buy vs ${s.bearish_count} sell signals`);
  }

  return lines.join("\n");
}

export interface MarketVisualData {
  symbol: string;
  price: number;
  support: number;
  resistance: number;
  confidence: number;
  bias: string;
  liquidationZonesDown: Array<{ price: number; distance_pct: number; leverage: string; risk: string }>;
  liquidationZonesUp: Array<{ price: number; distance_pct: number; leverage: string; risk: string }>;
  signals: {
    whaleFlow: number;
    smartMoney: number;
    derivatives: number;
    volatility: number;
    orderFlow: number;
    momentum: number;
  };
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  flowSentiment: string;
  largeTrades: number;
  longShortRatio: number;
  fundingRate: number;
  volatilityRegime: string;
  volatility7d: number;
  volatility30d: number;
  positionSizeMultiplier: number;
}

export async function buildMarketContext(query: string, overrideSymbols?: string[]): Promise<{ context: string; symbols: string[]; priceData: MarketVisualData[] }> {
  const symbols = overrideSymbols && overrideSymbols.length > 0 ? overrideSymbols : detectSymbols(query);
  const parts: string[] = [];
  const priceData: MarketVisualData[] = [];

  const [helsinkiResults, statics, whales, coinglass] = await Promise.all([
    Promise.all(symbols.map(s => fetchHelsinkiData(s))),
    fetchHelsinkiStatics(),
    fetchWhaleTransactions(),
    fetchCoinglassFunding(),
  ]);

  helsinkiResults.forEach(data => {
    if (data) {
      parts.push(formatHelsinkiContext(data));

      const sym = data.symbol?.replace("USDT", "") || "???";
      const price = data.liquidation?.current_price || 0;
      const support = data.liquidation?.downside_liquidation_zones?.[0]?.price || price * 0.95;
      const resistance = data.liquidation?.upside_liquidation_zones?.[0]?.price || price * 1.05;
      const confidence = data.synthesis?.confidence || 50;
      const bias = data.synthesis?.overall_bias || "neutral";

      const buyVol = data.large_trades?.total_buy_volume_usd || 0;
      const sellVol = data.large_trades?.total_sell_volume_usd || 0;
      const totalVol = buyVol + sellVol || 1;
      const whaleFlowRaw = (buyVol / totalVol) * 100;

      const smDivergence = data.smart_money?.divergence || 0;
      const topTraderRatio = data.smart_money?.top_trader_ls_ratio || 1;
      const smartMoneyRaw = Math.min(100, Math.max(0, 50 + (smDivergence * 30) + ((topTraderRatio - 1) * 20)));

      const lsRatio = data.liquidation?.long_short_ratio || 1;
      const derivativesRaw = Math.min(100, Math.max(0, 50 + (lsRatio - 1) * 50));

      const volProbs = data.volatility?.regime_probabilities;
      const volatilityRaw = volProbs
        ? Math.round(volProbs.low_vol * 100 + volProbs.normal * 55 + volProbs.high_vol * 10)
        : (data.volatility?.current_regime?.toLowerCase() === "high" ? 20 : data.volatility?.current_regime?.toLowerCase() === "low" ? 85 : 55);

      const netFlowUsd = data.large_trades?.net_flow_usd || 0;
      const flowMagnitude = Math.min(1, Math.abs(netFlowUsd) / (totalVol * 0.5 || 1));
      const orderFlowRaw = Math.min(100, Math.max(0, 50 + (netFlowUsd > 0 ? 1 : -1) * flowMagnitude * 40));

      const synthBull = data.synthesis?.bullish_count || 0;
      const synthBear = data.synthesis?.bearish_count || 0;
      const synthTotal = synthBull + synthBear || 1;
      const momentumRaw = Math.min(100, Math.max(0, (synthBull / synthTotal) * 100));

      priceData.push({
        symbol: sym,
        price,
        support,
        resistance,
        confidence,
        bias,
        liquidationZonesDown: (data.liquidation?.downside_liquidation_zones || []).map(z => ({
          price: z.price, distance_pct: z.distance_pct, leverage: z.leverage_trigger, risk: z.risk_level,
        })),
        liquidationZonesUp: (data.liquidation?.upside_liquidation_zones || []).map(z => ({
          price: z.price, distance_pct: z.distance_pct, leverage: z.leverage_trigger, risk: z.risk_level,
        })),
        signals: {
          whaleFlow: Math.round(whaleFlowRaw),
          smartMoney: Math.round(smartMoneyRaw),
          derivatives: Math.round(derivativesRaw),
          volatility: Math.round(volatilityRaw),
          orderFlow: Math.round(orderFlowRaw),
          momentum: Math.round(momentumRaw),
        },
        buyVolume: buyVol,
        sellVolume: sellVol,
        netFlow: netFlowUsd,
        flowSentiment: data.large_trades?.flow_sentiment || "neutral",
        largeTrades: data.large_trades?.large_trade_count || 0,
        longShortRatio: lsRatio,
        fundingRate: data.liquidation?.funding_rate_pct || 0,
        volatilityRegime: data.volatility?.current_regime || "normal",
        volatility7d: data.volatility?.volatility_7d_pct || 2.5,
        volatility30d: data.volatility?.volatility_30d_pct || 3.0,
        positionSizeMultiplier: data.volatility?.trading_adjustments?.position_size_multiplier || 1.0,
      });
    }
  });

  if (statics.fear_greed) {
    const fg = statics.fear_greed as { value?: number; classification?: string };
    if (fg.value !== undefined) {
      parts.push(`\nFEAR & GREED INDEX: ${fg.value} (${fg.classification || "N/A"})`);
    }
  }

  if (statics.dominance) {
    const dom = statics.dominance as { btc_dominance?: number };
    if (dom.btc_dominance) {
      parts.push(`BTC DOMINANCE: ${dom.btc_dominance}%`);
    }
  }

  if (whales && !whales.includes("unavailable") && !whales.includes("failed")) {
    parts.push(`\nWHALE TRANSACTIONS (Last Hour):\n${whales}`);
  }

  if (coinglass) {
    parts.push(`\n${coinglass}`);
  }

  if (parts.length === 0) {
    return { context: "", symbols, priceData };
  }

  let coinDirective = "";
  if (symbols.length > 1) {
    coinDirective = `\nIMPORTANT: The user is comparing ${symbols.join(" vs ")}. Data for ALL coins is provided above. Pick the STRONGEST coin and give your TRADE CALL for that winner. In the THESIS, explain why you chose it over the other(s).`;
  } else if (symbols.length === 1) {
    coinDirective = `\nIMPORTANT: The user is asking about ${symbols[0]}. Your TRADE CALL must be for ${symbols[0]} — do NOT switch to a different coin.`;
  }

  const hasPriceData = priceData.length > 0 && priceData.some(p => p.price > 0);
  const dataQualityNote = !hasPriceData
    ? `\nWARNING: Live price data is temporarily unavailable. Use the market sentiment data above for your Signal Matrix but set conviction LOW (0.45-0.50) and note "limited data" in your Thesis. Do NOT invent price levels — use approximate round numbers based on recent known prices.`
    : "";

  const context = `[MARKET SNAPSHOT]\n${parts.join("\n")}\n[/MARKET SNAPSHOT]${coinDirective}${dataQualityNote}\n\nGive the trade setup now. Translate the data into plain English reasons — do NOT mention any raw numbers from above:`;
  return { context, symbols, priceData };
}
