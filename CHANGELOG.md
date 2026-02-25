# Changelog

All notable changes to the Montra MCP Server.

## [1.2.0] — 2026-02-25

### Added — Wave 5: Social, Trading Sim, Leaderboard, Watchlist (30 → 38 tools)
- `simulate_trade` — Simulate a trade at current market prices — shows entry, fees, slippage, and projected P&L
- `get_agent_leaderboard` — Global agent leaderboard — rank agents by P&L, win rate, trades, or Sharpe ratio
- `manage_watchlist` — Create and manage a token watchlist — add, remove, and view with live prices
- `get_sentiment` — Aggregate sentiment analysis combining Farcaster social data, burn trends, and agent patterns
- `get_funding_rates` — Perpetual futures funding rates from Coinglass — identifies crowded trades
- `get_portfolio_history` — Track portfolio value over time with growth trends and benchmark comparisons
- `optimize_strategy_params` — Parameter sweep optimization for strategies — find optimal drawdown and position sizes
- `post_to_farcaster` — Broadcast messages to Farcaster from the Montra account via Neynar API

### Added — Wave 6: Vast.ai GPU Cluster Integration (38 → 43 tools)
- `search_gpu_offers` — Search Vast.ai marketplace for GPU offers by model, count, RAM, and price
- `rent_gpu_instance` — Rent a GPU instance on Vast.ai with custom Docker image and startup commands
- `get_gpu_instances` — List all running Vast.ai GPU instances with status, utilization, and cost
- `get_gpu_status` — Detailed real-time GPU instance status — utilization, temperature, memory, SSH info
- `destroy_gpu_instance` — Terminate and destroy a running Vast.ai GPU instance

### Platform Updates
- **CA Button** — Contract address copy-to-clipboard button on landing page hero section
- **Portfolio Page** — Enabled for all users (previously greyed out)
- **Transactions Page** — Enabled for all users (previously greyed out)
- **Analytics Page** — Enabled for all users — burn metrics, daily activity charts, complexity/status breakdowns
- **Terminal Fix** — Added timeouts to GPU fetch (90s), market data (15s), and streaming (120s) to prevent infinite "Generating trade..." hang
- **Empty Response Handling** — Stream that produces no content now shows error message instead of hanging

### Changed
- Version bumped to 1.2.0
- Updated startup banner for 43 tools
- GPU env vars: `VAST_API_KEY` for Vast.ai integration

---

## [1.1.0] — 2026-02-24

### Added — Wave 4 (22 → 30 tools)
- `send_xmtp_message` — Send encrypted wallet-to-wallet XMTP messages from Montra bot
- `get_xmtp_conversations` — List bot's XMTP conversations with message previews
- `manage_alerts` — Subscribe/unsubscribe to XMTP trade, milestone, burn, and status alerts
- `get_alert_subscriptions` — View all active XMTP alert subscriptions for a wallet
- `backtest_strategy` — Monte Carlo-style strategy backtest with custom budget, drawdown, and periods
- `get_correlation_matrix` — Cross-token price correlation analysis (2-8 tokens on Base chain)
- `get_whale_transfers` — Detect large $MONTRA token transfers — whale movements, burns, accumulation
- `get_trade_journal` — Formatted trade journal with streaks, best/worst days, and pattern insights
- Added `@xmtp/xmtp-js` and `ethers` dependencies for XMTP messaging
- XMTP env vars: `XMTP_BOT_PRIVATE_KEY`, `XMTP_ENV`
- Created `.env.example` for easy setup

### Changed
- Version bumped to 1.1.0
- Updated startup banner to display XMTP env status
- Updated all open source docs for 30 tools

---

## [1.0.0] — 2026-02-24

### Added — Wave 1 (6 → 12 tools)
- `get_burn_estimate` — Estimate $MONTRA burn cost with complexity detection
- `get_burn_history` — Burn transaction history by wallet
- `get_burn_analytics` — 90-day aggregated burn statistics
- `check_tier` — On-chain balance → tier resolution (Diamond/Gold/Silver/Bronze)
- `get_market_data` — Unified Coinglass + Helsinki VM + Whale Alert gateway
- `get_agent_performance` — Deep single-agent metrics with derived stats
- ASCII art startup banner with grouped tool loading and env var status

### Added — Wave 2 (12 → 16 tools)
- `get_token_price` — Instant price lookup by symbol or address
- `get_dashboard` — One-shot wallet overview (3 parallel queries)
- `get_farcaster_activity` — Farcaster cast monitoring with status breakdown
- `compare_agents` — Side-by-side agent comparison with rankings
- 5 MCP Resources (`montra://strategies`, `montra://tiers`, `montra://tokens`, `montra://burn-pricing`, `montra://platform`)
- 4 MCP Prompts (`deploy-agent`, `portfolio-review`, `market-brief`, `agent-health-check`)

### Added — Wave 3 (16 → 22 tools)
- `search_tokens` — DexScreener search filtered to Base chain
- `clone_agent` — Duplicate agent config with optional overrides
- `estimate_risk` — Composite risk score (0-100) with agent warnings
- `get_gas_status` — Base chain gas, block, ETH price, cost estimates
- `export_pnl` — P&L reports in summary/detailed/CSV format
- `get_liquidity` — DEX liquidity depth with price impact estimates
- 2 additional prompts (`risk-assessment`, `token-research`)

### Initial (6 tools)
- `list_strategies` — Strategy catalog with backtest stats
- `list_agents` — Agent listing by wallet
- `get_portfolio` — On-chain portfolio scanning
- `launch_agent` — Agent deployment
- `manage_agent` — Agent lifecycle control
- `recompose_portfolio` — Portfolio rebalancing

---

## Roadmap

- [ ] WebSocket streaming for real-time agent updates
- [ ] Multi-chain support (Arbitrum, Optimism)
- [x] Backtesting tool with historical simulation (`backtest_strategy`)
- [ ] Strategy marketplace integration
- [x] Alert/notification system via XMTP (`manage_alerts`, `send_xmtp_message`)
- [x] GPU cluster management (`search_gpu_offers`, `rent_gpu_instance`, `get_gpu_status`)
- [x] Trade simulation (`simulate_trade`)
- [x] Sentiment analysis (`get_sentiment`)
- [x] Agent leaderboard (`get_agent_leaderboard`)
- [ ] Agent-to-agent communication protocol
- [ ] On-chain order book integration
- [ ] AI-generated strategy recommendations
- [ ] Portfolio auto-rebalancing scheduler
