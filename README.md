<p align="center">
  <h1 align="center">MONTRA MCP SERVER</h1>
  <p align="center"><strong>Open Source AI Trading Intelligence for Claude</strong></p>
  <p align="center">30 Tools &bull; 5 Resources &bull; 6 Workflow Prompts &bull; Built on Base Chain</p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tools">Tools</a> &bull;
  <a href="#resources">Resources</a> &bull;
  <a href="#prompts">Prompts</a> &bull;
  <a href="TOOLS.md">Full Reference</a> &bull;
  <a href="quickstart.md">Setup Guide</a>
</p>

---

> **OPEN SOURCE PROJECT** — Montra Finance's MCP server is fully open source. Connect Claude directly to institutional-grade trading infrastructure on Base chain.

---

## What is Montra MCP?

Montra MCP is a **Model Context Protocol server** that gives Claude direct access to the Montra Finance trading platform. Deploy autonomous trading agents, scan portfolios, analyze market data, estimate burns, and manage positions — all through natural conversation with Claude.

| Feature | Details |
|---------|---------|
| **Protocol** | MCP (stdio transport) |
| **Tools** | 30 specialized trading, analytics & messaging tools |
| **Resources** | 5 static reference datasets |
| **Prompts** | 6 guided multi-step workflows |
| **Chain** | Base (Ethereum L2) |
| **Token** | $MONTRA (deflationary burn-to-query) |
| **Strategies** | 6 autonomous trading strategies |
| **Tier System** | Diamond / Gold / Silver / Bronze / Unranked |
| **AI Integration** | Purpose-built for Anthropic Claude |
| **License** | MIT |

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
      "cwd": "/path/to/montra-mcp-server",
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
git clone https://github.com/MontraFinance/montra-mcp-server.git
cd montra-mcp-server
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
│  30 Tools (Zod schemas) │
│  5 Resources (static)   │
│  6 Prompts (workflows)  │
└──┬──────┬──────┬────────┘
   │      │      │
   ▼      ▼      ▼
Supabase  Base   External APIs
  (DB)   (RPC)   ├── DexScreener
                  ├── Coinglass
                  ├── Helsinki VM
                  └── Whale Alert
```

**Data Flow:**
1. User talks to Claude in natural language
2. Claude invokes MCP tools with structured parameters
3. Zod validates every input against strict schemas
4. Server queries Supabase, Base RPC, or external APIs
5. Structured JSON response flows back to Claude
6. Claude reasons over data and responds conversationally

---

## Tools

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
| `check_tier` | On-chain $MONTRA balance check and tier resolution (Diamond→Bronze) |

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

Montra uses a deflationary burn model where $MONTRA tokens are burned for AI queries:

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

### Deploy a Trading Agent

```
You: Deploy a momentum strategy agent with $500 USDC budget and 15% max drawdown

Claude: I'll help you deploy that agent. Let me check a few things first.

  → list_strategies: Showing Momentum Rider stats (58.2% win rate, 1.62 Sharpe)
  → check_tier: You're Gold tier (12 max agents)
  → list_agents: You have 4 active agents (8 slots remaining)
  → launch_agent: Deploying with $500 USDC, 15% max drawdown, 25% max position

✅ Agent deployed! ID: agent-7f3a2b
   Strategy: Momentum Rider | Budget: $500 USDC
   Max Drawdown: 15% | Status: Deploying
```

### Portfolio Risk Assessment

```
You: How risky is my portfolio right now?

Claude: Let me run a comprehensive risk assessment.

  → estimate_risk: Composite score 67/100 (ELEVATED)
  → get_portfolio: $12,450 across 5 tokens
  → compare_agents: 3 agents — best is Arb Seeker (+$340)

⚠️ Risk Score: 67/100 (Elevated)
   - Strategy concentration: 60% momentum (high)
   - Agent "Grid-01" has -$89 unrealized loss
   - Recommendation: Diversify into mean reversion or DCA
```

### Token Research

```
You: Research DEGEN before I trade it

Claude: Let me pull the data on DEGEN.

  → search_tokens: Found DEGEN on Base (0x4ed4...)
  → get_token_price: $0.0089 (+12.3% 24h)
  → get_liquidity: $2.4M total liquidity across 6 DEX pairs

📊 DEGEN Token Report:
   Price: $0.0089 | 24h: +12.3%
   Liquidity: $2.4M (Moderate)
   Price Impact: ~0.5% for $1K trade, ~4.8% for $10K
   Top DEX: Uniswap V3 ($1.8M)
   ⚠️ Caution: Thin liquidity above $5K trade size
```

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
| Deployment | Vercel Serverless |

---

## Project Structure

```
montra-mcp-server/
├── src/
│   ├── index.ts              # Server entry — registers all tools, resources, prompts
│   ├── prompts.ts            # 6 workflow prompt templates
│   ├── resources.ts          # 5 static MCP resources
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── rpc.ts            # Base chain RPC helpers
│   │   ├── prices.ts         # DexScreener price fetcher
│   │   ├── tokens.ts         # Curated Base token list
│   │   └── strategies.ts     # Strategy definitions & backtest stats
│   └── tools/
│       ├── list-strategies.ts
│       ├── list-agents.ts
│       ├── launch-agent.ts
│       ├── manage-agent.ts
│       ├── clone-agent.ts
│       ├── get-portfolio.ts
│       ├── recompose-portfolio.ts
│       ├── get-agent-performance.ts
│       ├── compare-agents.ts
│       ├── export-pnl.ts
│       ├── get-token-price.ts
│       ├── search-tokens.ts
│       ├── get-liquidity.ts
│       ├── get-burn-estimate.ts
│       ├── get-burn-history.ts
│       ├── get-burn-analytics.ts
│       ├── check-tier.ts
│       ├── get-market-data.ts
│       ├── get-gas-status.ts
│       ├── get-dashboard.ts
│       ├── estimate-risk.ts
│       ├── get-farcaster-activity.ts
│       ├── send-xmtp-message.ts
│       ├── get-xmtp-conversations.ts
│       ├── manage-alerts.ts
│       ├── get-alert-subscriptions.ts
│       ├── backtest-strategy.ts
│       ├── get-correlation-matrix.ts
│       ├── get-whale-transfers.ts
│       └── get-trade-journal.ts
├── package.json
├── tsconfig.json
├── mcp-config.json           # Copy-paste Claude config
├── quickstart.md             # 60-second setup guide
├── TOOLS.md                  # Complete tool reference
├── LICENSE                   # MIT
└── README.md                 # This file
```

---

## Contributing

We welcome contributions! Areas where help is needed:

- **New tools** — Add market data sources, analytics, or chain integrations
- **Documentation** — Examples, workflow guides, and prompt templates
- **Bug reports** — File issues with reproduction steps
- **Testing** — Unit tests for tool handlers

### Development

```bash
# Clone
git clone https://github.com/MontraFinance/montra-mcp-server.git
cd montra-mcp-server

# Install
npm install

# Run (stdio transport)
npx tsx src/index.ts

# Type check
npx tsc --noEmit
```

---

## Links

- **Website:** [montrafinance.com](https://www.montrafinance.com)
- **Developer Docs:** [montrafinance.com/docs](https://www.montrafinance.com/docs)
- **Twitter/X:** [@MontraFinance](https://x.com/MontraFinance)
- **Farcaster:** [@montrafinance](https://warpcast.com/montrafinance)
- **Telegram:** [Montra_Finance](https://t.me/Montra_Finance)
- **GitHub:** [MontraFinance](https://github.com/MontraFinance)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Montra Finance — Institutional AI Trading Intelligence, Built on Base</strong><br/>
  <sub>30 tools &bull; 5 resources &bull; 6 prompts &bull; Powered by Claude</sub>
</p>
