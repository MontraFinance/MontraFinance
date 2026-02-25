<div align="center">

# MONTRA MCP SERVER

**Open Source AI Trading Intelligence for Claude**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-8B5CF6?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)](https://modelcontextprotocol.io/)
[![Base Chain](https://img.shields.io/badge/Base-Chain-0052FF?logo=coinbase&logoColor=white)](https://base.org)
[![Tools](https://img.shields.io/badge/Tools-43-green)](TOOLS.md)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

```
 ███╗   ███╗ ██████╗ ███╗   ██╗████████╗██████╗  █████╗
 ████╗ ████║██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔══██╗
 ██╔████╔██║██║   ██║██╔██╗ ██║   ██║   ██████╔╝███████║
 ██║╚██╔╝██║██║   ██║██║╚██╗██║   ██║   ██╔══██╗██╔══██║
 ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║   ██║   ██║  ██║██║  ██║
 ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
              MCP SERVER  ·  v1.2.0
```

**43 Tools** · **5 Resources** · **6 Workflow Prompts** · **Built on Base Chain**

[Quick Start](#-quick-start) · [Tools](#-tools-43) · [Architecture](#-architecture) · [Strategies](#-strategies) · [Full Reference](TOOLS.md) · [Setup Guide](quickstart.md)

</div>

---

> **100% OPEN SOURCE** — Montra Finance's MCP server is fully open source under the MIT license. Connect Claude directly to institutional-grade DeFi trading infrastructure on Base chain. No API keys required for core functionality.

---

## Why Montra MCP?

| | Feature | Description |
|---|---------|-------------|
| **43** | Specialized Tools | Trading, analytics, portfolio, burn, XMTP, GPU, social, and more |
| **6** | Trading Strategies | Backtested autonomous strategies with proven performance |
| **5** | MCP Resources | Static reference datasets Claude can read on demand |
| **6** | Workflow Prompts | Pre-built multi-step operations for common tasks |
| **0** | Lock-in | MIT licensed, no vendor lock-in, bring your own data sources |

### What Can You Do?

- Deploy autonomous trading agents with custom strategies, budgets, and risk parameters
- Scan on-chain portfolios with real-time token prices and allocation analysis
- Run Monte Carlo backtests on trading strategies with custom parameters
- Monitor whale movements and large $MONTRA transfers in real-time
- Send encrypted wallet-to-wallet messages via XMTP
- Analyze market data from Coinglass, DexScreener, Helsinki VM, and Whale Alert
- Track burn-to-query costs with complexity-based pricing estimation
- Export P&L reports, trade journals, and correlation matrices
- Simulate trades with slippage and fee estimation before executing
- Track agent leaderboards ranked by P&L, Sharpe ratio, or win rate
- Aggregate sentiment from Farcaster social data and on-chain patterns
- Manage GPU clusters on Vast.ai — search, rent, monitor, and destroy instances
- Optimize strategy parameters with automated sweeps across drawdown and position sizes

---

## Quick Start

### Option 1: Claude Code (Recommended)

```bash
claude mcp add montra -- npx tsx src/index.ts
```

### Option 2: Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "montra": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/MontraFinance",
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

### Option 3: Direct

```bash
git clone https://github.com/MontraFinance/MontraFinance.git
cd MontraFinance
npm install
npx tsx src/index.ts
```

The server communicates over **stdin/stdout** using the MCP stdio transport. Any MCP-compatible client can connect.

---

## Architecture

```
                    ┌─────────────────────────┐
                    │      Claude (AI)        │
                    │   Natural Conversation  │
                    └────────────┬────────────┘
                                 │ MCP Protocol (stdio)
                    ┌────────────▼────────────┐
                    │    MONTRA MCP SERVER    │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │  43 Tools (Zod)   │  │
                    │  │  5 Resources      │  │
                    │  │  6 Prompts        │  │
                    │  └───────────────────┘  │
                    └──┬──────┬──────┬────────┘
                       │      │      │
              ┌────────┘      │      └────────┐
              ▼               ▼               ▼
         ┌─────────┐   ┌──────────┐   ┌──────────────┐
         │Supabase │   │  Base    │   │External APIs │
         │  (DB)   │   │  (RPC)  │   │              │
         └─────────┘   └──────────┘   │ DexScreener  │
                                      │ Coinglass    │
                                      │ Helsinki VM  │
                                      │ Whale Alert  │
                                      │ XMTP         │
                                      │ Neynar       │
                                      │ Vast.ai      │
                                      └──────────────┘
```

**Data Flow:**
1. User talks to Claude in natural language
2. Claude invokes MCP tools with structured parameters
3. Zod validates every input against strict schemas
4. Server queries Supabase, Base RPC, or external APIs
5. Structured JSON response flows back to Claude
6. Claude reasons over data and responds conversationally

---

## Tools (43)

### Trading (8 tools)

| Tool | Description |
|------|-------------|
| `list_strategies` | List all 6 trading strategies with backtest stats, risk levels, and default configs |
| `list_agents` | List all trading agents for a wallet — status, config, and performance |
| `launch_agent` | Deploy a new autonomous trading agent with strategy, budget, and risk parameters |
| `clone_agent` | Duplicate an existing agent's config into a new agent with optional overrides |
| `manage_agent` | Pause, resume, or stop a running trading agent |
| `get_agent_performance` | Deep dive — P&L history, budget utilization, uptime, derived metrics |
| `compare_agents` | Side-by-side comparison with rankings by P&L, win rate, and trade count |
| `export_pnl` | Export P&L reports in summary, detailed, or CSV format |

### Portfolio (4 tools)

| Tool | Description |
|------|-------------|
| `get_portfolio` | Scan on-chain holdings — token balances, USD values, allocation percentages |
| `recompose_portfolio` | Suggest or execute portfolio rebalancing across token allocations |
| `get_dashboard` | One-shot wallet overview — tier, agent summary, recent burn activity |
| `estimate_risk` | Composite risk score (0-100) with concentration analysis and agent warnings |

### Price & Liquidity (3 tools)

| Tool | Description |
|------|-------------|
| `get_token_price` | Instant price lookup by symbol or contract address via DexScreener |
| `search_tokens` | Search any Base chain token — returns price, liquidity, and contract address |
| `get_liquidity` | DEX liquidity depth with all trading pairs, volume, and price impact estimates |

### Burn & Tier (4 tools)

| Tool | Description |
|------|-------------|
| `get_burn_estimate` | Estimate $MONTRA burn cost for an AI query based on complexity |
| `get_burn_history` | Burn transaction history for a wallet from the ledger |
| `get_burn_analytics` | 90-day aggregated burn stats — complexity breakdowns, daily trends |
| `check_tier` | On-chain $MONTRA balance check and tier resolution (Diamond to Bronze) |

### Market Data & Network (2 tools)

| Tool | Description |
|------|-------------|
| `get_market_data` | Unified gateway — Coinglass derivatives, Helsinki VM quant, Whale Alert |
| `get_gas_status` | Base chain gas price, latest block, ETH price, and TX cost estimates |

### Social (1 tool)

| Tool | Description |
|------|-------------|
| `get_farcaster_activity` | Monitor Farcaster cast history — status breakdown and success rate |

### XMTP Messaging (4 tools)

| Tool | Description |
|------|-------------|
| `send_xmtp_message` | Send encrypted XMTP message from Montra bot to any wallet |
| `get_xmtp_conversations` | List bot's XMTP conversations with message previews |
| `manage_alerts` | Subscribe/unsubscribe to XMTP trade, milestone, burn, and status alerts |
| `get_alert_subscriptions` | View all active XMTP alert subscriptions for a wallet |

### Advanced Analytics (4 tools)

| Tool | Description |
|------|-------------|
| `backtest_strategy` | Monte Carlo-style strategy backtest with custom budget, drawdown, and periods |
| `get_correlation_matrix` | Cross-token price correlation analysis on Base chain (2-8 tokens) |
| `get_whale_transfers` | Detect large $MONTRA transfers — whale movements, burns, accumulation |
| `get_trade_journal` | Formatted trade journal with streaks, best/worst days, and pattern insights |

### Social & Sentiment (3 tools)

| Tool | Description |
|------|-------------|
| `get_sentiment` | Aggregate sentiment analysis — Farcaster social data, burn trends, agent patterns |
| `post_to_farcaster` | Broadcast messages to Farcaster from the Montra account via Neynar API |
| `get_funding_rates` | Perpetual futures funding rates from Coinglass — identifies crowded trades |

### Trading Simulation (3 tools)

| Tool | Description |
|------|-------------|
| `simulate_trade` | Simulate a trade at current prices — entry, fees, slippage, projected P&L |
| `get_agent_leaderboard` | Global agent leaderboard — rank by P&L, win rate, trades, or Sharpe ratio |
| `optimize_strategy_params` | Parameter sweep optimization — find optimal drawdown and position sizes |

### Watchlist & History (2 tools)

| Tool | Description |
|------|-------------|
| `manage_watchlist` | Create and manage a token watchlist — add, remove, view with live prices |
| `get_portfolio_history` | Track portfolio value over time — growth trends, benchmarks, best/worst periods |

### GPU Cluster (5 tools)

| Tool | Description |
|------|-------------|
| `search_gpu_offers` | Search Vast.ai marketplace for GPU offers by model, count, RAM, and price |
| `rent_gpu_instance` | Rent a GPU instance on Vast.ai with custom Docker image and startup commands |
| `get_gpu_instances` | List all running Vast.ai GPU instances — status, utilization, cost |
| `get_gpu_status` | Real-time GPU instance status — utilization, temperature, memory, SSH info |
| `destroy_gpu_instance` | Terminate and destroy a running Vast.ai GPU instance |

> See **[TOOLS.md](TOOLS.md)** for the complete reference with parameters and example responses.

---

## Resources

Static reference data that Claude can read on demand. No API calls — curated platform knowledge.

| URI | Description |
|-----|-------------|
| `montra://strategies` | All 6 trading strategies with backtest stats, risk levels, and default configs |
| `montra://tiers` | $MONTRA holder tier definitions — thresholds, discounts, perks, agent limits |
| `montra://tokens` | Curated Base chain token list with contract addresses and decimals |
| `montra://burn-pricing` | Burn-to-query pricing — complexity tiers, resource multipliers, USD costs |
| `montra://platform` | Montra Finance platform overview — features, chain, token, links |

---

## Prompts

Pre-built workflow templates that walk Claude through multi-step operations.

| Prompt | Description | Tools Used |
|--------|-------------|------------|
| `deploy-agent` | Step-by-step agent deployment — strategy selection, risk params, budget | `list_strategies` `check_tier` `list_agents` `launch_agent` |
| `portfolio-review` | Comprehensive portfolio health check with optimization suggestions | `get_dashboard` `get_portfolio` `compare_agents` `get_burn_analytics` `recompose_portfolio` |
| `market-brief` | Quick market intelligence brief with derivatives and whale data | `get_market_data` `get_token_price` |
| `agent-health-check` | Deep dive into agent performance and risk metrics | `get_agent_performance` `list_strategies` |
| `risk-assessment` | Full portfolio risk assessment with concentration analysis | `estimate_risk` `get_portfolio` `compare_agents` `get_gas_status` `get_agent_performance` |
| `token-research` | Research a token before trading — price, liquidity, safety | `search_tokens` `get_token_price` `get_liquidity` |

---

## Strategies

Montra supports 6 autonomous trading strategies, each with backtested performance:

| Strategy | Risk | Win Rate | Avg Return | Sharpe | Max DD | Trades |
|----------|------|----------|------------|--------|--------|--------|
| **Momentum Rider** | High | 58.2% | 4.1% | 1.62 | 18.4% | 1,247 |
| **Mean Reversion** | Medium | 64.7% | 2.3% | 2.14 | 8.9% | 2,034 |
| **Arbitrage Seeker** | Low | 71.3% | 0.8% | 3.22 | 3.1% | 4,521 |
| **Breakout Hunter** | High | 49.8% | 5.6% | 1.41 | 22.7% | 891 |
| **Grid Trading** | Low | 77.1% | 1.2% | 2.88 | 6.2% | 3,678 |
| **DCA Accumulator** | Low | 68.4% | 1.8% | 2.31 | 9.8% | 1,456 |

---

## Tier System

Hold $MONTRA tokens on Base to unlock higher tiers:

| Tier | Min Tokens | Max Agents | Burn Discount | Key Perks |
|------|-----------|-----------|--------------|-----------|
| **Diamond** | 5B | 20 | 50% | Unlimited queries, exclusive strategies, priority slots |
| **Gold** | 1B | 12 | 30% | Advanced strategies, extra agent slots |
| **Silver** | 500M | 8 | 15% | Silver strategy pack, enhanced monitoring |
| **Bronze** | 100M | 5 | 5% | Basic holder badge |
| **Unranked** | 0 | 3 | 0% | Standard access |

---

## Burn-to-Query Pricing

Montra uses a deflationary burn model where $MONTRA tokens are permanently burned for AI queries:

| Complexity | Multiplier | USD Cost | Examples |
|-----------|-----------|---------|----------|
| Simple | 1x | $0.25 | Basic lookups, price checks |
| Medium | 3x | $0.75 | Queries >200 chars, moderate analysis |
| Complex | 10x | $2.50 | Trend analysis, forecasts, comparisons |
| Very Complex | 32x | $8.00 | Backtesting, Monte Carlo, portfolio optimization |

**Resource Multipliers:**
- Real-time data: +50%
- Historical lookback: +30%
- Multi-asset comparison: +40%

---

## Example Conversations

<details>
<summary><strong>Deploy a Trading Agent</strong></summary>

```
You: Deploy a momentum strategy agent with $500 USDC budget and 15% max drawdown

Claude: I'll help you deploy that agent. Let me check a few things first.

  list_strategies  Showing Momentum Rider stats (58.2% win rate, 1.62 Sharpe)
  check_tier       You're Gold tier (12 max agents)
  list_agents      You have 4 active agents (8 slots remaining)
  launch_agent     Deploying with $500 USDC, 15% max drawdown, 25% max position

Agent deployed! ID: agent-7f3a2b
   Strategy: Momentum Rider | Budget: $500 USDC
   Max Drawdown: 15% | Status: Deploying
```

</details>

<details>
<summary><strong>Portfolio Risk Assessment</strong></summary>

```
You: How risky is my portfolio right now?

Claude: Let me run a comprehensive risk assessment.

  estimate_risk   Composite score 67/100 (ELEVATED)
  get_portfolio   $12,450 across 5 tokens
  compare_agents  3 agents — best is Arb Seeker (+$340)

Risk Score: 67/100 (Elevated)
   - Strategy concentration: 60% momentum (high)
   - Agent "Grid-01" has -$89 unrealized loss
   - Recommendation: Diversify into mean reversion or DCA
```

</details>

<details>
<summary><strong>Token Research</strong></summary>

```
You: Research DEGEN before I trade it

Claude: Let me pull the data on DEGEN.

  search_tokens    Found DEGEN on Base (0x4ed4...)
  get_token_price  $0.0089 (+12.3% 24h)
  get_liquidity    $2.4M total liquidity across 6 DEX pairs

DEGEN Token Report:
   Price: $0.0089 | 24h: +12.3%
   Liquidity: $2.4M (Moderate)
   Price Impact: ~0.5% for $1K trade, ~4.8% for $10K
   Top DEX: Uniswap V3 ($1.8M)
   Caution: Thin liquidity above $5K trade size
```

</details>

<details>
<summary><strong>Whale Tracking</strong></summary>

```
You: Are there any whale movements on MONTRA?

Claude: Let me check for large transfers.

  get_whale_transfers  Scanning last 24h for transfers > 10M MONTRA

Whale Activity Report:
   3 large transfers detected in last 24h
   - 500M MONTRA moved to burn address (deflationary burn)
   - 250M MONTRA accumulated by 0x8f2a... (new whale)
   - 100M MONTRA transferred between two known wallets
   Net flow: -500M (bullish — supply reduction)
```

</details>

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `BASE_RPC_URL` | No | Base RPC endpoint (defaults to `https://mainnet.base.org`) |
| `BURN_TOKEN_ADDRESS` | No | $MONTRA token contract on Base |
| `COINGLASS_KEY` | No | Coinglass API key for derivatives data |
| `WHALE_ALERT_KEY` | No | Whale Alert API key for large transactions |
| `HELSINKI_BASE` | No | Helsinki VM base URL for quant signals |
| `XMTP_BOT_PRIVATE_KEY` | No | Private key for XMTP bot wallet (enables messaging tools) |
| `XMTP_ENV` | No | XMTP network: `production` or `dev` (default: `production`) |
| `VAST_API_KEY` | No | Vast.ai API key for GPU cluster management |
| `NEYNAR_API_KEY` | No | Neynar API key for Farcaster posting |
| `FARCASTER_SIGNER_UUID` | No | Farcaster signer UUID for autonomous posts |

See [.env.example](.env.example) for a complete template.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | TypeScript + Node.js |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Validation | Zod |
| Database | Supabase (PostgreSQL) |
| Blockchain | Base (Ethereum L2) via JSON-RPC |
| Price Data | DexScreener API |
| Derivatives | Coinglass API |
| Quant Signals | Helsinki VM |
| Whale Tracking | Whale Alert API |
| Social | Neynar (Farcaster) |
| Messaging | XMTP (wallet-to-wallet encrypted) |
| GPU | Vast.ai (cloud GPU marketplace) |

---

## Project Structure

```
MontraFinance/
├── src/
│   ├── index.ts              # Server entry — registers all tools, resources, prompts
│   ├── prompts.ts            # 6 workflow prompt templates
│   ├── resources.ts          # 5 static MCP resources
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client singleton
│   │   ├── rpc.ts            # Base chain JSON-RPC helpers
│   │   ├── prices.ts         # DexScreener price fetcher
│   │   ├── tokens.ts         # Curated Base chain token list
│   │   └── strategies.ts     # Strategy definitions & backtest stats
│   └── tools/                # 43 tool implementations
│       ├── list-strategies.ts ... get-trade-journal.ts
├── .github/                  # Issue templates, PR template, funding
├── package.json
├── tsconfig.json
├── mcp-config.json           # Copy-paste Claude Desktop config
├── .env.example              # Environment variable template
├── quickstart.md             # 60-second setup guide
├── TOOLS.md                  # Complete tool reference
├── CONTRIBUTING.md           # How to contribute
├── SECURITY.md               # Security policy
├── CODE_OF_CONDUCT.md        # Community guidelines
├── CHANGELOG.md              # Version history
├── LICENSE                   # MIT
└── README.md                 # This file
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

**Areas where help is needed:**

- **New tools** — Add market data sources, analytics, or chain integrations
- **Multi-chain** — Extend support beyond Base to Arbitrum, Optimism, etc.
- **Documentation** — Examples, workflow guides, and prompt templates
- **Testing** — Unit tests for tool handlers
- **Bug reports** — File issues with reproduction steps

### Development

```bash
# Clone
git clone https://github.com/MontraFinance/MontraFinance.git
cd MontraFinance

# Install
npm install

# Run (stdio transport)
npx tsx src/index.ts

# Type check
npx tsc --noEmit
```

---

## Links

| | Link |
|---|---|
| Website | [montrafinance.com](https://www.montrafinance.com) |
| Developer Docs | [montrafinance.com/docs](https://www.montrafinance.com/docs) |
| Twitter/X | [@MontraFinance](https://x.com/MontraFinance) |
| Farcaster | [@montrafinance](https://warpcast.com/montrafinance) |
| Telegram | [Montra_Finance](https://t.me/Montra_Finance) |
| GitHub | [MontraFinance](https://github.com/MontraFinance) |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Montra Finance — Institutional AI Trading Intelligence, Built on Base**

43 tools · 5 resources · 6 prompts · Powered by Claude

[![Twitter Follow](https://img.shields.io/twitter/follow/MontraFinance?style=social)](https://x.com/MontraFinance)
[![GitHub stars](https://img.shields.io/github/stars/MontraFinance/MontraFinance?style=social)](https://github.com/MontraFinance/MontraFinance)

</div>
