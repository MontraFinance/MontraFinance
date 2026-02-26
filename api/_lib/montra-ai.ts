/**
 * Montra AI query helper — calls the same Ollama GPU endpoint used by api/chat.ts
 * but in non-streaming mode for server-side cron/API usage.
 *
 * Uses native Ollama API format: POST {MONTRA_GPU_URL}/api/chat
 * with think:false (matches api/chat.ts:72-81).
 */

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TradeRecommendation {
  action: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  token: string;
  positionSizePct: number;
}

/** Scored outcome from a past AI consultation — fed back into prompts */
export interface TradeOutcome {
  action: "buy" | "sell" | "hold";
  confidence: number;
  wasCorrect: boolean;
  pnlPct: number;
  pnlUsd: number;
  reasoning: string;
  scoredAt: string;
}

/** Sibling agent summary for portfolio context */
export interface PortfolioContext {
  totalAgents: number;
  combinedPnlUsd: number;
  combinedBudget: number;
  combinedRemainingBudget: number;
  siblings: Array<{
    name: string;
    strategy: string;
    pnlUsd: number;
    pnlPct: number;
    tradeCount: number;
    status: string;
  }>;
  /** On-chain balances for this agent */
  onChainBalances?: {
    usdcBalance?: number;
    ethBalance?: number;
    montraBalance?: number;
  };
}

/**
 * Call the Montra AI model (Ollama) with a non-streaming request.
 * Returns the raw response text.
 */
export async function queryMontraAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const gpuUrl = process.env.MONTRA_GPU_URL;
  if (!gpuUrl) throw new Error("MONTRA_GPU_URL env var not configured");

  const model = process.env.MONTRA_AI_MODEL || "qwen3:14b";

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const payload = {
    model,
    messages,
    stream: false,
    think: false,
    options: {
      num_predict: 1000,
      temperature: 0.3,
    },
  };

  const response = await fetch(`${gpuUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI model returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}

/**
 * Build the system + user prompt for an agent's trading consultation.
 * Now includes full portfolio context: user's other agents, combined P&L,
 * and on-chain balances so the AI has a complete picture.
 */
export function buildAgentTradingPrompt(
  agent: {
    config: any;
    stats: any;
    wallet_data: any;
    agent_wallet_address: string;
  },
  recentTrades: any[],
  prices: { ethUsd?: number; btcUsd?: number },
  portfolio?: PortfolioContext,
  trackRecord?: TradeOutcome[],
): { system: string; user: string } {
  const config = agent.config || {};
  const stats = agent.stats || {};
  const wallet = agent.wallet_data || {};

  // Build track record section for system prompt
  let trackRecordRule = "";
  if (trackRecord && trackRecord.length > 0) {
    const wins = trackRecord.filter((t) => t.wasCorrect).length;
    const total = trackRecord.length;
    const winRate = ((wins / total) * 100).toFixed(0);
    trackRecordRule = `
- Your recent accuracy is ${winRate}% (${wins}/${total} correct). Learn from your mistakes — review your track record below.
- If your recent calls have been wrong, reduce confidence and position sizes. If you've been accurate, you can be slightly more aggressive.`;
  }

  const system = `You are a trading advisor for an autonomous crypto trading agent on Base chain (Ethereum L2).
You analyze the agent's current state, its portfolio context, market conditions, and YOUR OWN PAST PERFORMANCE to provide a trading recommendation.

ALWAYS respond with a JSON object in this exact format:
{"action":"buy"|"sell"|"hold","confidence":0-100,"reasoning":"...","token":"WETH"|"USDC","positionSizePct":0-100}

Rules:
- Only recommend "buy" or "sell" if confidence > 60
- Respect the agent's max drawdown (${config.maxDrawdownPct || 15}%) and max position size (${config.maxPositionSizePct || 25}%)
- If the agent is losing money, be conservative
- Consider the agent's remaining budget before recommending position sizes
- Consider the user's overall portfolio health — if the portfolio is heavily down, be more conservative
- If this agent has had multiple consecutive losses, prefer "hold" unless very confident
- "token" should be the token to buy (for buy action) or sell (for sell action)
- Keep reasoning concise but informative — the user will see it${trackRecordRule}`;

  const tradesSummary = recentTrades.length > 0
    ? recentTrades.map((t, i) => {
        const status = t.status || "unknown";
        const sell = t.sell_token?.slice(-6) || "?";
        const buy = t.buy_token?.slice(-6) || "?";
        return `  ${i + 1}. ${sell} → ${buy} | status: ${status} | amount: ${t.sell_amount || "?"}`;
      }).join("\n")
    : "  No recent trades";

  // Build portfolio section if available
  let portfolioSection = "";
  if (portfolio) {
    const siblingLines = portfolio.siblings
      .filter((s) => s.name !== config.name) // exclude self
      .map((s) => `  - ${s.name} (${s.strategy}): P&L $${s.pnlUsd.toFixed(2)} (${s.pnlPct.toFixed(1)}%), ${s.tradeCount} trades, ${s.status}`)
      .join("\n");

    portfolioSection = `
User's Portfolio Overview:
- Total Agents: ${portfolio.totalAgents}
- Combined P&L: $${portfolio.combinedPnlUsd.toFixed(2)}
- Total Budget Allocated: $${portfolio.combinedBudget.toFixed(2)}
- Total Remaining Budget: $${portfolio.combinedRemainingBudget.toFixed(2)}
${siblingLines ? `- Other Agents:\n${siblingLines}` : "- This is the user's only agent"}
`;
  }

  // Build on-chain balance section
  let balanceSection = "";
  if (portfolio?.onChainBalances) {
    const b = portfolio.onChainBalances;
    balanceSection = `
On-Chain Balances (Agent Wallet):
- USDC: $${b.usdcBalance?.toFixed(2) ?? "unknown"}
- ETH: ${b.ethBalance?.toFixed(6) ?? "unknown"} ETH${b.ethBalance !== undefined && prices.ethUsd ? ` (~$${(b.ethBalance * prices.ethUsd).toFixed(2)})` : ""}
- MONTRA: ${b.montraBalance?.toFixed(0) ?? "unknown"} (for AI consultation fees)
`;
  }

  // Build track record section
  let trackRecordSection = "";
  if (trackRecord && trackRecord.length > 0) {
    const lines = trackRecord.map((t) => {
      const icon = t.wasCorrect ? "✅" : "❌";
      const pnlSign = t.pnlPct >= 0 ? "+" : "";
      const action = t.action.toUpperCase();
      const reasoning = t.reasoning.length > 80 ? t.reasoning.slice(0, 80) + "…" : t.reasoning;
      return `  ${icon} ${action} (${t.confidence}% conf) → ${pnlSign}${t.pnlPct.toFixed(1)}% ($${t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(2)}) — "${reasoning}"`;
    }).join("\n");

    const wins = trackRecord.filter((t) => t.wasCorrect).length;
    trackRecordSection = `
Your Past Recommendations (most recent first):
Track Record: ${wins}/${trackRecord.length} correct
${lines}
`;
  }

  const user = `Agent: ${config.name || "Unnamed"}
Strategy: ${config.strategyId || "unknown"}
Mandate: ${config.mandate || "No mandate set"}

Current State:
- P&L: $${(stats.pnlUsd || 0).toFixed(2)} (${(stats.pnlPct || 0).toFixed(2)}%)
- Trade Count: ${stats.tradeCount || 0}
- Win Rate: ${(stats.winRate || 0).toFixed(1)}%
- Allocated Budget: $${(wallet.allocatedBudget || 0).toFixed(2)}
- Remaining Budget: $${(wallet.remainingBudget || 0).toFixed(2)}
${balanceSection}${portfolioSection}${trackRecordSection}
Market Prices:
- ETH: $${prices.ethUsd?.toFixed(2) || "unavailable"}
- BTC: $${prices.btcUsd?.toFixed(2) || "unavailable"}

Recent Trades (last 10):
${tradesSummary}

Based on this full context — including your past performance — what trading action should this agent take right now? Respond with JSON only.`;

  return { system, user };
}

/**
 * Parse the AI response to extract a structured trade recommendation.
 * Looks for JSON in the response, falls back to keyword parsing.
 */
export function parseTradeRecommendation(response: string): TradeRecommendation {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: ["buy", "sell", "hold"].includes(parsed.action) ? parsed.action : "hold",
        confidence: typeof parsed.confidence === "number" ? Math.min(100, Math.max(0, parsed.confidence)) : 50,
        reasoning: parsed.reasoning || "",
        token: parsed.token || "WETH",
        positionSizePct: typeof parsed.positionSizePct === "number" ? Math.min(100, Math.max(0, parsed.positionSizePct)) : 10,
      };
    } catch {
      // JSON parse failed, fall through to keyword parsing
    }
  }

  // Fallback: keyword-based parsing
  const lower = response.toLowerCase();
  let action: "buy" | "sell" | "hold" = "hold";
  if (lower.includes('"buy"') || lower.includes("recommend buy") || lower.includes("action: buy")) {
    action = "buy";
  } else if (lower.includes('"sell"') || lower.includes("recommend sell") || lower.includes("action: sell")) {
    action = "sell";
  }

  return {
    action,
    confidence: 50,
    reasoning: response.slice(0, 500),
    token: "WETH",
    positionSizePct: 10,
  };
}
