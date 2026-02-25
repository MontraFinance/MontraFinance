# MONTRA MCP — Complete Tool Reference

> 43 Tools | 5 Resources | 6 Prompts — Full parameter specs, response schemas, and usage examples.

---

## Trading Tools (8)

### `list_strategies`

List all 6 autonomous trading strategies with live backtest stats.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters required |

**Response:**
```json
{
  "strategies": [
    {
      "id": "momentum",
      "name": "MOMENTUM RIDER",
      "description": "Rides sustained directional moves using multi-timeframe trend confirmation",
      "riskLevel": "high",
      "backtestStats": {
        "winRate": 58.2,
        "avgReturn": 4.1,
        "sharpeRatio": 1.62,
        "maxDrawdown": 18.4,
        "totalTrades": 1247
      },
      "tags": ["trend", "crypto", "high-vol"],
      "defaultConfig": {
        "maxDrawdownPct": 20,
        "maxPositionSizePct": 25,
        "budgetCurrency": "USDC"
      }
    }
  ]
}
```

---

### `list_agents`

Fetch all trading agents for a wallet address.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | 0x... wallet address |

**Response:** Array of agent objects with `id`, `status`, `config`, `stats`, `wallet_data`, `pnl_history`.

---

### `launch_agent`

Deploy a new autonomous trading agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Deployer wallet address |
| `strategy` | string | Yes | Strategy ID (`momentum`, `mean_reversion`, `arbitrage`, `breakout`, `grid_trading`, `dca`) |
| `name` | string | No | Custom agent name |
| `budgetAmount` | number | Yes | Budget allocation |
| `budgetCurrency` | string | No | Budget currency (default: `USDC`) |
| `maxDrawdownPct` | number | No | Max drawdown percentage |
| `maxPositionSizePct` | number | No | Max position size percentage |

**Response:** Created agent object with `id`, `status: "deploying"`, and full config.

---

### `clone_agent`

Duplicate an existing agent's configuration into a new agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `sourceAgentId` | string | Yes | Agent ID to clone |
| `overrides` | object | No | Config overrides (name, budget, strategy, etc.) |

**Response:** New agent with same config as source but fresh stats and new ID.

---

### `manage_agent`

Control an agent's lifecycle — pause, resume, or stop.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `agentId` | string | Yes | Agent ID |
| `action` | string | Yes | `pause`, `resume`, or `stop` |

---

### `get_agent_performance`

Deep performance analysis for a single agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `agentId` | string | Yes | Agent ID |

**Response:**
```json
{
  "agent": { "id": "...", "status": "active", "config": {...} },
  "performance": {
    "totalPnl": 342.50,
    "winRate": 62.4,
    "totalTrades": 187,
    "budgetUtilization": "68.5%",
    "uptime": "14d 6h 23m",
    "pnlHistory": [...]
  }
}
```

---

### `compare_agents`

Side-by-side comparison of multiple agents with rankings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `agentIds` | string[] | No | Specific agent IDs (default: all agents) |

**Response:** Array of agents with derived stats, ranked by P&L, win rate, and trade count.

---

### `export_pnl`

Export P&L reports in multiple formats.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `format` | string | No | `summary` (default), `detailed`, or `csv` |
| `agentId` | string | No | Specific agent (default: all) |

**Formats:**
- `summary` — JSON aggregate stats (total P&L, win rate, best/worst agent)
- `detailed` — Full P&L history per agent with timestamps
- `csv` — Comma-separated for spreadsheet import

---

## Portfolio Tools (4)

### `get_portfolio`

Scan on-chain token holdings for a wallet on Base chain.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | 0x... wallet address |

**Response:**
```json
{
  "holdings": [
    { "symbol": "ETH", "balance": "2.45", "usdValue": 7840.00, "allocation": "63.0%" },
    { "symbol": "USDC", "balance": "3200", "usdValue": 3200.00, "allocation": "25.7%" },
    { "symbol": "MONTRA", "balance": "500000000", "usdValue": 1400.00, "allocation": "11.3%" }
  ],
  "totalUsdValue": 12440.00
}
```

---

### `recompose_portfolio`

Suggest or simulate portfolio rebalancing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `targetAllocations` | object | Yes | Target allocation map (e.g., `{ "ETH": 50, "USDC": 30, "MONTRA": 20 }`) |
| `mode` | string | No | `preview` (default) or `execute` |

---

### `get_dashboard`

One-shot wallet overview combining tier, agents, and burns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |

**Response:** Tier status + agent count/summary + 30-day burn totals in a single call. Runs 3 parallel queries.

---

### `estimate_risk`

Composite portfolio risk score with breakdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |

**Response:**
```json
{
  "riskScore": 67,
  "rating": "ELEVATED",
  "breakdown": {
    "strategyConcentration": 35,
    "highRiskExposure": 18,
    "drawdownWeighted": 14
  },
  "agentWarnings": [
    { "agentId": "grid-01", "warning": "Approaching max drawdown (87% utilized)" }
  ]
}
```

---

## Price & Liquidity Tools (3)

### `get_token_price`

Instant price lookup via DexScreener.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbolOrAddress` | string | Yes | Token symbol (`ETH`, `MONTRA`) or contract address (`0x...`) |

**Response:** Price in USD, 24h change, volume, market cap, and DEX pair info.

---

### `search_tokens`

Search for any token on Base chain.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search term (name, symbol, or partial match) |

**Response:** Matching tokens with price, liquidity, contract address, and DEX pairs. Filters to Base chain only, deduplicates by highest liquidity.

---

### `get_liquidity`

DEX liquidity depth analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbolOrAddress` | string | Yes | Token symbol or contract address |

**Response:**
```json
{
  "token": "DEGEN",
  "totalLiquidity": 2400000,
  "depthRating": "MODERATE",
  "pairs": [
    { "dex": "Uniswap V3", "liquidity": 1800000, "volume24h": 450000 },
    { "dex": "Aerodrome", "liquidity": 600000, "volume24h": 120000 }
  ],
  "priceImpact": {
    "$100": "0.05%",
    "$1,000": "0.5%",
    "$10,000": "4.8%"
  }
}
```

---

## Burn & Tier Tools (4)

### `get_burn_estimate`

Estimate $MONTRA burn cost for a query.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The query text to estimate cost for |

**Response:** Detected complexity tier, USD cost, token amount to burn, and breakdown.

---

### `get_burn_history`

Fetch burn transaction history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |
| `limit` | number | No | Max records (default: 50, max: 100) |

---

### `get_burn_analytics`

Aggregated burn statistics over 90 days.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |

**Response:** Total burns, tokens burned, confirmed count, complexity breakdown, status breakdown, daily activity array.

---

### `check_tier`

Check on-chain $MONTRA balance and resolve membership tier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address |

**Response:**
```json
{
  "tier": "GOLD",
  "balance": "1500000000",
  "maxAgents": 12,
  "burnDiscount": "30%",
  "perks": ["Advanced strategies unlocked", "Extra agent slots", "Gold analytics tier"]
}
```

---

## Market Data & Network Tools (2)

### `get_market_data`

Unified gateway to three external data sources.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | `coinglass`, `helsinki`, or `whale_alert` |
| `path` | string | Conditional | API path (required for coinglass & helsinki) |
| `symbol` | string | No | Asset symbol for filtering |

**Source Details:**
- **Coinglass:** Derivatives data — funding rates, open interest, liquidations. Paths must start with `/futures/`
- **Helsinki VM:** Quant signals — `/quant/full/{SYMBOL}`, `/sentiment/`, `/derivatives/`
- **Whale Alert:** Large transaction monitoring — min_value, time window, limit

---

### `get_gas_status`

Base chain network status and gas costs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters required |

**Response:**
```json
{
  "gasPrice": "0.012 gwei",
  "gasPriceWei": "12000000",
  "blockNumber": 28456789,
  "ethPrice": 3200.45,
  "estimates": {
    "transfer": "$0.003",
    "swap": "$0.008",
    "agentDeploy": "$0.015"
  }
}
```

---

## Social Tools (1)

### `get_farcaster_activity`

Monitor Montra's Farcaster broadcasting.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max casts to return (default: 20) |
| `status` | string | No | Filter by status: `posted`, `failed`, `skipped` |

**Response:** Cast history with hashes, content, timestamps, and status breakdown (success rate, total posted, total failed).

---

## XMTP Messaging Tools (4)

### `send_xmtp_message`

Send an encrypted XMTP message from the Montra bot to any wallet address.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recipientAddress` | string | Yes | 0x... wallet address of the recipient |
| `message` | string | Yes | Message text to send |

**Response:**
```json
{
  "success": true,
  "recipientAddress": "0x...",
  "messagePreview": "Your momentum agent just...",
  "timestamp": "2026-02-24T12:00:00Z",
  "botAddress": "0xb5aecF3619Bb677e8c580BD9352cE190F3565B0d"
}
```

---

### `get_xmtp_conversations`

List the Montra bot's recent XMTP conversations with message previews.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max conversations to return (default: 20, max: 50) |

**Response:**
```json
{
  "botAddress": "0xb5ae...",
  "totalConversations": 12,
  "conversations": [
    {
      "peerAddress": "0x...",
      "lastMessage": {
        "content": "status",
        "senderAddress": "0x...",
        "timestamp": "2026-02-24T11:30:00Z"
      }
    }
  ]
}
```

---

### `manage_alerts`

Subscribe, unsubscribe, or update XMTP alert preferences for a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | 0x... wallet address |
| `action` | string | Yes | `subscribe`, `unsubscribe`, or `update` |
| `agentId` | string | No | Specific agent ID (default: all agents) |
| `alertTypes` | string[] | No | Alert types: `trade`, `milestone`, `burn`, `status` (default: all) |

**Response:**
```json
{
  "success": true,
  "action": "subscribe",
  "walletAddress": "0x...",
  "alertTypes": ["trade", "milestone", "burn", "status"],
  "agentId": "all",
  "deliveryMethod": "XMTP"
}
```

---

### `get_alert_subscriptions`

View all active XMTP alert subscriptions for a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | 0x... wallet address |

**Response:**
```json
{
  "walletAddress": "0x...",
  "totalSubscriptions": 3,
  "activeCount": 2,
  "inactiveCount": 1,
  "subscriptions": [
    {
      "id": "uuid",
      "agentId": "agent-7f3a2b",
      "alertTypes": ["trade", "milestone"],
      "enabled": true,
      "createdAt": "2026-02-20T10:00:00Z"
    }
  ]
}
```

---

## Advanced Analytics Tools (4)

### `backtest_strategy`

Run a Monte Carlo-style simulated backtest for any trading strategy with custom parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `strategy` | string | Yes | Strategy ID: `momentum`, `mean_reversion`, `arbitrage`, `breakout`, `grid_trading`, `dca` |
| `budget` | number | Yes | Initial budget in USD (min: 10, max: 10M) |
| `maxDrawdownPct` | number | No | Max drawdown % before stopping (default: 20) |
| `maxPositionSizePct` | number | No | Max position size as % of equity (default: 25) |
| `periods` | number | No | Months to simulate (default: 12, max: 36) |

**Response:**
```json
{
  "strategy": "MOMENTUM RIDER",
  "parameters": { "initialBudget": 1000, "maxDrawdownPct": 20, "periods": 12 },
  "results": {
    "finalEquity": 1342.50,
    "totalReturnPct": "34.25%",
    "totalTrades": 104,
    "wins": 61,
    "losses": 43,
    "winRate": 58.65,
    "maxDrawdownPct": "14.2%",
    "drawdownBreached": false
  },
  "equityCurve": [{ "period": 0, "equity": 1000 }, { "period": 1, "equity": 1045.20 }],
  "benchmarkStats": { "strategyWinRate": 58.2, "strategySharpe": 1.62 }
}
```

---

### `get_correlation_matrix`

Cross-token price correlation analysis on Base chain. Shows how tokens move relative to each other.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokens` | string[] | Yes | 2-8 token symbols to compare (e.g., `["ETH", "DEGEN", "AERO", "MONTRA"]`) |

**Response:**
```json
{
  "tokens": [
    { "symbol": "ETH", "price": 3200.45, "change24h": "2.1%", "volume24h": 4500000 }
  ],
  "correlationMatrix": {
    "ETH": { "ETH": 1.0, "DEGEN": 0.72, "AERO": 0.85 },
    "DEGEN": { "ETH": 0.72, "DEGEN": 1.0, "AERO": 0.61 }
  },
  "strongestCorrelations": [
    { "pair": "ETH/AERO", "correlation": 0.85 }
  ]
}
```

---

### `get_whale_transfers`

Detect large $MONTRA token transfers on Base chain — whale movements, burns, and accumulation patterns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `minTokens` | number | No | Minimum token amount (default: 10,000,000) |
| `blocks` | number | No | Recent blocks to scan (default: 1000, ~30 min) |

**Response:**
```json
{
  "blocksScanned": 1000,
  "totalWhaleTransfers": 5,
  "totalBurns": 2,
  "totalBurnedAmount": 150000000,
  "transfers": [
    {
      "type": "BURN",
      "from": "0x...",
      "to": "0x...dead",
      "amount": "100,000,000",
      "txHash": "0x...",
      "block": 28456789
    }
  ]
}
```

---

### `get_trade_journal`

Generate a formatted trade journal from agent P&L history with pattern analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | 0x... wallet address |
| `agentId` | string | No | Specific agent ID (default: all agents) |

**Response:**
```json
{
  "summary": {
    "totalAgents": 4,
    "activeAgents": 3,
    "totalPnl": 1245.67,
    "totalTrades": 567,
    "bestDay": { "pnl": 89.50, "date": "2026-02-20", "agent": "agent-7f3a" },
    "worstDay": { "pnl": -45.20, "date": "2026-02-18", "agent": "agent-2b1c" },
    "longestWinStreak": 7,
    "longestLoseStreak": 3
  },
  "agents": [
    {
      "agentId": "agent-7f3a",
      "strategy": "momentum",
      "status": "active",
      "totalPnl": 542.30,
      "totalTrades": 187,
      "winRate": 62.4,
      "recentHistory": [{ "date": "2026-02-24", "pnl": 12.50 }]
    }
  ],
  "insight": "Portfolio is profitable ($1245.67). Strong momentum detected."
}
```

---

## Social & Sentiment Tools (3)

### `get_sentiment`

Aggregate sentiment analysis combining Farcaster social data, burn trends, and agent trading patterns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | No | Token symbol to analyze (default: `MONTRA`) |
| `days` | number | No | Lookback period in days, 1-90 (default: 7) |

---

### `post_to_farcaster`

Broadcast a message to Farcaster from the Montra account via Neynar API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Cast text content (1-1024 characters) |
| `eventType` | string | No | Event type: `market_update`, `agent_milestone`, `burn_event`, `custom` (default: `custom`) |
| `eventKey` | string | No | Event key for deduplication |

---

### `get_funding_rates`

Get current perpetual futures funding rates from Coinglass — shows market positioning and identifies crowded trades.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Asset symbol (e.g., `BTC`, `ETH`). Omit for top assets overview |
| `limit` | number | No | Number of assets to return, 1-50 (default: 10) |

---

## Trading Simulation Tools (3)

### `simulate_trade`

Simulate a trade at current market prices without executing — shows entry, fees, slippage estimate, and projected P&L targets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Token you're selling (symbol or address, e.g., `USDC`) |
| `tokenOut` | string | Yes | Token you're buying (symbol or address, e.g., `ETH`) |
| `amountIn` | number | Yes | Amount of tokenIn to spend |
| `slippagePct` | number | No | Expected slippage percentage, 0-50 (default: 0.5) |

---

### `get_agent_leaderboard`

Global agent leaderboard — ranks all trading agents across the platform by P&L, win rate, or trade count.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rankBy` | string | No | Ranking metric: `pnl`, `win_rate`, `trades`, `sharpe` (default: `pnl`) |
| `limit` | number | No | Top N agents to return, 1-50 (default: 10) |
| `strategyFilter` | string | No | Filter by strategy type |
| `statusFilter` | string | No | Filter by status: `active`, `paused`, `stopped`, `all` (default: `active`) |

---

### `optimize_strategy_params`

Find optimal strategy parameters by running parameter sweeps across drawdown limits and position sizes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `strategy` | string | Yes | Strategy ID to optimize |
| `budget` | number | Yes | Budget to optimize for in USD (100-10M) |
| `periods` | number | No | Months to simulate per sweep, 3-36 (default: 12) |
| `optimizeFor` | string | No | Optimization target: `return`, `sharpe`, `safety` (default: `sharpe`) |

---

## Watchlist & History Tools (2)

### `manage_watchlist`

Create, view, and manage a token watchlist with live prices and change alerts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address that owns the watchlist |
| `action` | string | Yes | Action: `view`, `add`, `remove` |
| `tokens` | string[] | No | Token symbols to add or remove (e.g., `["ETH", "DEGEN"]`) |

---

### `get_portfolio_history`

Track portfolio value over time — shows snapshots, growth trends, benchmark comparisons, and best/worst periods.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address (0x format) |
| `days` | number | No | Lookback period in days, 1-365 (default: 30) |

---

## GPU Cluster Tools (5)

### `search_gpu_offers`

Search Vast.ai GPU marketplace for available offers filtered by GPU model, count, RAM, and max price.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gpu_name` | string | No | GPU model name (default: `RTX_5090`) |
| `num_gpus` | number | No | Minimum number of GPUs, 1-8 (default: 4) |
| `max_price` | number | No | Maximum price per hour in USD (default: 5.0) |
| `min_ram` | number | No | Minimum GPU RAM in MB per GPU (default: 28000) |
| `limit` | number | No | Maximum results, 1-50 (default: 10) |

---

### `rent_gpu_instance`

Rent a GPU instance on Vast.ai by specifying an offer ID with optional Docker image, disk size, and startup commands.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `offer_id` | number | Yes | Offer ID from `search_gpu_offers` results |
| `image` | string | No | Docker image (default: `pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel`) |
| `disk_gb` | number | No | Disk space in GB, 10-500 (default: 80) |
| `onstart_cmd` | string | No | Shell command to run on instance startup |

---

### `get_gpu_instances`

List all your running Vast.ai GPU instances with status, SSH details, GPU utilization, cost, and uptime.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters required |

---

### `get_gpu_status`

Get detailed real-time status of a specific Vast.ai GPU instance — utilization, temperature, memory, SSH info, and cost breakdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance_id` | number | Yes | Vast.ai instance ID |

---

### `destroy_gpu_instance`

Terminate and destroy a running Vast.ai GPU instance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance_id` | number | Yes | Vast.ai instance ID to destroy |
| `confirm` | boolean | Yes | Must be `true` to confirm destruction |

---

## Resources (5)

| URI | Content |
|-----|---------|
| `montra://strategies` | All 6 strategies with full backtest stats and default configs |
| `montra://tiers` | Diamond/Gold/Silver/Bronze/Unranked definitions with thresholds and perks |
| `montra://tokens` | Curated Base token list — ETH, USDC, MONTRA, cbETH, DAI, DEGEN, etc. |
| `montra://burn-pricing` | Complexity tiers (Simple→Very Complex), multipliers, resource add-ons |
| `montra://platform` | Platform info — name, tagline, chain, token, features, socials |

---

## Prompts (6)

### `deploy-agent`
**Args:** `walletAddress` (optional)
Walks through: strategy selection → tier verification → agent limit check → parameter setup → deployment → confirmation.

### `portfolio-review`
**Args:** `walletAddress` (optional)
Walks through: dashboard overview → on-chain scan → agent comparison → burn analytics → rebalancing suggestions → summary.

### `market-brief`
**Args:** `symbol` (optional, default: BTC)
Pulls: Helsinki quant analysis → Coinglass funding/OI → Whale Alert → token price → synthesized brief with bias assessment.

### `agent-health-check`
**Args:** `walletAddress` (optional), `agentId` (optional)
Analyzes: full performance stats → benchmark comparison → budget utilization → drawdown check → recommendation.

### `risk-assessment`
**Args:** `walletAddress` (optional)
Runs: composite risk score → on-chain holdings → agent comparison → gas status → deep analysis on flagged agents → action items.

### `token-research`
**Args:** `token` (optional)
Checks: token search → price lookup → liquidity depth → pair availability → price impact estimates → red flag detection.

---

<p align="center"><sub>Montra Finance — 43 tools, 5 resources, 6 prompts — Powered by Claude</sub></p>
