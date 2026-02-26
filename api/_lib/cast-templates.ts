/**
 * Farcaster cast message templates
 * All return strings under 320 characters. Pure functions, no side effects.
 */

interface AgentInfo {
  id: string;
  config?: { name?: string; strategy?: string; strategyId?: string };
  erc8004_agent_id?: number | null;
}

interface BurnInfo {
  id: string;
  amount: number;
  wallet_address: string;
}

function agentName(agent: AgentInfo): string {
  return agent.config?.name || agent.id.slice(0, 8);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
}

export function castAgentDeployed(agent: AgentInfo): string {
  const name = agentName(agent);
  const strategy = agent.config?.strategy || agent.config?.strategyId || "custom";
  const erc8004Tag = agent.erc8004_agent_id
    ? ` | ERC-8004 #${agent.erc8004_agent_id} on Base`
    : "";
  return truncate(
    `\ud83e\udd16 New agent "${name}" deployed on Montra Finance using ${strategy} strategy${erc8004Tag}.`,
    320,
  );
}

export function castAgentRegistered(agent: AgentInfo): string {
  const name = agentName(agent);
  return truncate(
    `\ud83d\udee1\ufe0f Agent "${name}" now has a verified on-chain identity via ERC-8004 (#${agent.erc8004_agent_id}) on Base. View at www.8004scan.io/agents/base/${agent.erc8004_agent_id}`,
    320,
  );
}

export function castPnlMilestone(agent: AgentInfo, threshold: number): string {
  const name = agentName(agent);
  const formatted = threshold >= 1000 ? `$${(threshold / 1000).toFixed(0)}K` : `$${threshold}`;
  return truncate(
    `\ud83d\udcc8 Agent "${name}" just crossed ${formatted} in P&L on Montra Finance. Autonomous trading on Base is heating up \ud83d\udd25`,
    320,
  );
}

export function castTradeMilestone(agent: AgentInfo, count: number): string {
  const name = agentName(agent);
  return truncate(
    `\u26a1 Agent "${name}" has executed ${count.toLocaleString()} trades on Montra Finance. Fully autonomous on Base.`,
    320,
  );
}

export function castBurnConfirmed(burn: BurnInfo): string {
  const amount = burn.amount.toLocaleString();
  return truncate(
    `\ud83d\udd25 ${amount} $MONTRA burned on Base. Wallet ${burn.wallet_address.slice(0, 6)}...${burn.wallet_address.slice(-4)} just reduced the supply forever.`,
    320,
  );
}

export function castSentimentTrade(score: number, usdcAmount: number): string {
  const scoreDisplay = score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  return truncate(
    `\ud83d\udce1 Community vibes triggered a buy! Farcaster sentiment hit ${scoreDisplay} \u2014 auto-bought $${usdcAmount} USDC of $MONTRA via CoW Protocol (MEV-protected). The community speaks, the protocol listens.`,
    320,
  );
}

export function castSentimentTradeFilled(
  score: number,
  usdcAmount: number,
  montraAmount: string,
): string {
  const montraHuman = (Number(BigInt(montraAmount)) / 1e18).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  const scoreDisplay = score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  return truncate(
    `\u2705 Sentiment trade filled! ${montraHuman} $MONTRA bought for $${usdcAmount} USDC (sentiment ${scoreDisplay}). MEV-protected via CoW Protocol on Base.`,
    320,
  );
}

interface TokenDeployInfo {
  name: string;
  symbol: string;
  tokenAddress: string;
  deployerWallet: string;
}

export function castTokenDeployed(token: TokenDeployInfo): string {
  const shortAddr = `${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}`;
  return truncate(
    `\ud83d\ude80 $${token.symbol} (${token.name}) just launched on Base via Montra Finance! Token: ${shortAddr}. Uniswap v4 pool live with MEV protection. LP fees fuel the $MONTRA buyback flywheel \ud83d\udd25`,
    320,
  );
}

export function castFeesClaimed(totalWeth: string, tokenCount: number): string {
  return truncate(
    `\ud83d\udcb0 LP fees harvested! Claimed ${totalWeth} WETH from ${tokenCount} Clawncher token${tokenCount > 1 ? "s" : ""}. Revenue feeds back into the $MONTRA buyback/burn flywheel.`,
    320,
  );
}
