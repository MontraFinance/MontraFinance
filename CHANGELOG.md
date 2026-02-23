# Changelog

All notable changes to the Montra MCP Server.

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
- [ ] Agent-to-agent communication protocol
- [ ] On-chain order book integration
- [ ] AI-generated strategy recommendations
- [ ] Portfolio auto-rebalancing scheduler
