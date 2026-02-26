import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Terminal,
  Wallet,
  BarChart3,
  Flame,
  Globe,
  Search,
  Copy,
  Check,
  ChevronRight,
  Zap,
  Shield,
  BookOpen,
  Code2,
  Layers,
  MessageSquare,
  Activity,
  TrendingUp,
  DollarSign,
  Fuel,
  Users,
  FileText,
  Crosshair,
  GitBranch,
  PieChart,
  ArrowDownUp,
  LayoutDashboard,
  Gauge,
  Coins,
  History,
  Award,
} from "lucide-react";
import { GPU_CONFIG, AI_MODELS, MCP_CONFIG } from "@/config/platform";

/* ─── Copy-to-clipboard helper ─── */
function CopyBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 text-muted-foreground hover:text-primary transition-colors z-10"
        aria-label="Copy"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <pre className="bg-[hsl(240,10%,8%)] border border-border rounded-xl p-4 overflow-x-auto text-sm font-mono text-[hsl(0,0%,80%)] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─── Data ─── */

const TOOL_CATEGORIES = [
  {
    id: "trading",
    label: "Trading",
    icon: TrendingUp,
    tools: [
      { name: "list_strategies", desc: "List all 6 trading strategies with backtest stats, risk levels, and default configs" },
      { name: "list_agents", desc: "List all trading agents for a wallet with status, config, and performance stats" },
      { name: "launch_agent", desc: "Deploy a new autonomous trading agent with strategy, budget, and risk parameters" },
      { name: "clone_agent", desc: "Duplicate an existing agent's configuration into a new agent with optional overrides" },
      { name: "manage_agent", desc: "Pause, resume, or stop a running trading agent" },
      { name: "get_agent_performance", desc: "Deep dive into a single agent's stats, P&L history, budget utilization, and uptime" },
      { name: "compare_agents", desc: "Side-by-side comparison of multiple agents with rankings by P&L, win rate, and trade count" },
      { name: "export_pnl", desc: "Export P&L reports in summary, detailed, or CSV format with portfolio-level aggregates" },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: PieChart,
    tools: [
      { name: "recompose_portfolio", desc: "Suggest or execute portfolio rebalancing across token allocations on Base" },
      { name: "get_portfolio", desc: "Scan on-chain holdings for a wallet — token balances, USD values, and allocation percentages" },
      { name: "get_dashboard", desc: "One-shot wallet overview combining tier status, agent summary, and recent burn activity" },
      { name: "estimate_risk", desc: "Composite risk score (0-100) with strategy concentration, drawdown exposure, and agent warnings" },
    ],
  },
  {
    id: "price",
    label: "Price & Liquidity",
    icon: DollarSign,
    tools: [
      { name: "get_token_price", desc: "Instant price lookup by symbol or 0x address via DexScreener" },
      { name: "search_tokens", desc: "Search any Base chain token by name or symbol — returns price, liquidity, and contract address" },
      { name: "get_liquidity", desc: "DEX liquidity depth analysis with all trading pairs, volume, and price impact estimates" },
    ],
  },
  {
    id: "burn",
    label: "Burn & Tier",
    icon: Flame,
    tools: [
      { name: "get_burn_estimate", desc: "Estimate $MONTRA burn cost for an AI query based on complexity analysis" },
      { name: "get_burn_history", desc: "Fetch burn transaction history for a wallet from the ledger" },
      { name: "get_burn_analytics", desc: "Aggregated burn statistics — 90-day totals, complexity breakdowns, daily activity trends" },
      { name: "check_tier", desc: "Check $MONTRA balance on-chain and resolve membership tier (Diamond/Gold/Silver/Bronze)" },
    ],
  },
  {
    id: "market",
    label: "Market Data & Network",
    icon: Globe,
    tools: [
      { name: "get_market_data", desc: "Unified gateway to Coinglass derivatives, Helsinki VM quant signals, and Whale Alert" },
      { name: "get_gas_status", desc: "Base chain gas price, latest block, ETH price, and estimated transaction costs in USD" },
    ],
  },
  {
    id: "social",
    label: "Social & Sentiment",
    icon: MessageSquare,
    tools: [
      { name: "get_farcaster_activity", desc: "Monitor Farcaster cast history — status breakdown, success rate, and recent casts" },
      { name: "post_to_farcaster", desc: "Broadcast messages to Farcaster from the Montra account — market updates, milestones, custom posts" },
      { name: "get_sentiment", desc: "Aggregate sentiment from Farcaster activity, on-chain burns, and agent trading patterns into a composite score" },
    ],
  },
  {
    id: "xmtp",
    label: "XMTP Messaging",
    icon: Zap,
    tools: [
      { name: "send_xmtp_message", desc: "Send encrypted wallet-to-wallet XMTP message from the Montra bot to any address" },
      { name: "get_xmtp_conversations", desc: "List the bot's recent XMTP conversations with message previews and timestamps" },
      { name: "manage_alerts", desc: "Subscribe/unsubscribe to XMTP alerts for trade, milestone, burn, and status events" },
      { name: "get_alert_subscriptions", desc: "View all active XMTP alert subscriptions for a wallet with alert type details" },
    ],
  },
  {
    id: "analytics",
    label: "Advanced Analytics",
    icon: BarChart3,
    tools: [
      { name: "backtest_strategy", desc: "Monte Carlo-style strategy backtest with custom budget, drawdown, position size, and periods" },
      { name: "get_correlation_matrix", desc: "Cross-token price correlation analysis on Base chain — compare 2-8 tokens" },
      { name: "get_whale_transfers", desc: "Detect large $MONTRA transfers on Base — whale movements, burns, and accumulation patterns" },
      { name: "get_trade_journal", desc: "Formatted trade journal from agent P&L history with streaks, best/worst days, and pattern insights" },
      { name: "optimize_strategy_params", desc: "Parameter sweep optimizer — tests 42 configs of drawdown and position size, recommends best settings" },
    ],
  },
  {
    id: "intelligence",
    label: "Trading Intelligence",
    icon: Crosshair,
    tools: [
      { name: "simulate_trade", desc: "Paper trade simulator — slippage, DEX fees, P&L targets, stop-loss levels. No funds moved" },
      { name: "get_funding_rates", desc: "Perpetual futures funding rates from Coinglass — market positioning and crowded trade detection" },
      { name: "get_agent_leaderboard", desc: "Global agent rankings by P&L, win rate, trade count, or Sharpe ratio across the platform" },
      { name: "manage_watchlist", desc: "Token watchlist with live price tracking and change alerts — add, remove, or view with prices" },
      { name: "get_portfolio_history", desc: "Portfolio value snapshots over time — growth trends, win/loss streaks, max drawdown" },
    ],
  },
  {
    id: "gpu",
    label: "GPU Cluster",
    icon: Gauge,
    tools: [
      { name: "search_gpu_offers", desc: "Search Vast.ai marketplace for GPU instances — filter by model, count, RAM, and hourly price" },
      { name: "rent_gpu_instance", desc: "Rent a GPU instance from Vast.ai — specify Docker image, disk size, and startup commands" },
      { name: "get_gpu_instances", desc: "List all running Vast.ai instances with SSH details, utilization, cost, and uptime" },
      { name: "get_gpu_status", desc: "Real-time status of a specific GPU instance — utilization, temperature, VRAM, SSH, and cost" },
      { name: "destroy_gpu_instance", desc: "Terminate and destroy a Vast.ai GPU instance with confirmation safety check" },
    ],
  },
];

const RESOURCES = [
  { uri: "montra://strategies", desc: "All 6 trading strategies with backtest stats, risk levels, and default configurations" },
  { uri: "montra://tiers", desc: "$MONTRA holder tier definitions — thresholds, discounts, perks, and agent limits" },
  { uri: "montra://tokens", desc: "Curated Base chain token list with contract addresses and decimals" },
  { uri: "montra://burn-pricing", desc: "Burn-to-query pricing model — complexity tiers, resource multipliers, and USD costs" },
  { uri: "montra://platform", desc: "Montra Finance platform overview — features, chain, token, and links" },
];

const PROMPTS = [
  { name: "deploy-agent", desc: "Step-by-step workflow to deploy a new trading agent" },
  { name: "portfolio-review", desc: "Comprehensive portfolio health check with optimization suggestions" },
  { name: "market-brief", desc: "Quick market intelligence brief with derivatives and whale data" },
  { name: "agent-health-check", desc: "Deep dive into a specific agent's performance and risk metrics" },
  { name: "risk-assessment", desc: "Full portfolio risk assessment with concentration analysis" },
  { name: "token-research", desc: "Research a token before trading — price, liquidity, and safety checks" },
];

const SIDEBAR_SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "quickstart", label: "Quick Start", icon: Zap },
  { id: "installation", label: "Installation", icon: Terminal },
  { id: "npx", label: "npx Install", icon: Terminal },
  { id: "tools", label: "Tools (43)", icon: Code2 },
  { id: "resources", label: "Resources (5)", icon: Layers },
  { id: "prompts", label: "Prompts (6)", icon: MessageSquare },
  { id: "architecture", label: "Architecture", icon: GitBranch },
  { id: "tiers", label: "Tier System", icon: Award },
];

const NPX_INSTALL = `npx montra-mcp-server`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "montra": {
      "command": "npx",
      "args": ["-y", "montra-mcp-server"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key",
        "BASE_RPC_URL": "https://mainnet.base.org",
        "BURN_TOKEN_ADDRESS": "0x...",
        "COINGLASS_KEY": "your-coinglass-key",
        "WHALE_ALERT_KEY": "your-whale-alert-key",
        "HELSINKI_BASE": "https://api.helsinkivm.com",
        "VAST_AI_API_KEY": "your-vast-ai-key"
      }
    }
  }
}`;

const CLAUDE_CODE_CONFIG = `claude mcp add montra \\
  --command "npx" \\
  --args "-y,montra-mcp-server" \\
  --env "SUPABASE_URL=...,BASE_RPC_URL=https://mainnet.base.org"`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "montra": {
      "command": "npx",
      "args": ["-y", "montra-mcp-server"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}`;

const EXAMPLE_USAGE = `> "Deploy a momentum strategy agent with $500 USDC budget
   and 15% max drawdown"

Claude will automatically:
  1. list_strategies   → show available strategies
  2. check_tier        → verify your tier limits
  3. list_agents       → check existing agents
  4. launch_agent      → deploy the agent
  5. get_agent_performance → confirm deployment`;

/* ─── Page Component ─── */

const DeveloperDocs = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [installTab, setInstallTab] = useState<"desktop" | "code" | "cursor" | "api">("desktop");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft size={16} />
              <span className="text-sm font-mono">Back</span>
            </Link>
            <div className="h-5 w-px bg-border" />
            <span className="text-lg font-bold tracking-tight text-primary">Montra Finance</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border">
              MCP Server v1.3.0 · npm
            </span>
            <a
              href="https://github.com/MontraFinance/MontraFinance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-border p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Bot size={18} className="text-primary" />
              <span className="text-sm font-bold text-primary">Developer Docs</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">MCP Protocol Reference</p>
          </div>

          <nav className="space-y-1">
            {SIDEBAR_SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono transition-colors ${
                  activeSection === id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>

          {/* Tool category sub-nav */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 font-mono">Tool Categories</p>
            <nav className="space-y-1">
              {TOOL_CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(`cat-${id}`)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12 space-y-20">
          {/* OVERVIEW */}
          <section id="overview">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">Developer Documentation</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-primary mb-6">
              Montra MCP Server
            </h1>
            <p className="text-lg text-muted-foreground font-mono max-w-3xl mb-8 leading-relaxed">
              Connect Claude directly to the Montra Finance trading infrastructure. {MCP_CONFIG.toolCount} tools, {MCP_CONFIG.resourceCount} resources, and {MCP_CONFIG.promptCount} workflow prompts give AI full access to autonomous trading agents, portfolio management, market intelligence, GPU clusters, and the $MONTRA burn economy on Base chain.
            </p>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Tools", value: String(MCP_CONFIG.toolCount), icon: Code2 },
                { label: "Resources", value: String(MCP_CONFIG.resourceCount), icon: Layers },
                { label: "Prompts", value: String(MCP_CONFIG.promptCount), icon: MessageSquare },
                { label: "Strategies", value: "6", icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground font-mono">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Claude emphasis box */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 flex gap-4 items-start">
              <div className="bg-primary/20 p-3 rounded-xl shrink-0">
                <Bot size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-primary mb-2">Built for Claude</h3>
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  Montra's MCP server is purpose-built for Anthropic's Claude. Every tool returns structured JSON that Claude can reason over. Workflow prompts guide Claude through multi-step operations like deploying agents, reviewing portfolios, and assessing risk — all through natural conversation.
                </p>
              </div>
            </div>
          </section>

          {/* QUICK START */}
          <section id="quickstart">
            <SectionHeader icon={Zap} label="Quick Start" title="Up and Running in 60 Seconds" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { step: "01", title: "Install", desc: "One command: npx montra-mcp-server — no clone needed" },
                { step: "02", title: "Configure", desc: "Add your Supabase, RPC, and API keys to your MCP config" },
                { step: "03", title: "Connect", desc: "Point Claude Desktop or Claude Code at the MCP server" },
              ].map(({ step, title, desc }) => (
                <div key={step} className="bg-card border border-border rounded-xl p-6">
                  <div className="text-xs font-mono text-primary mb-3">STEP {step}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{desc}</p>
                </div>
              ))}
            </div>
            <CopyBlock
              code={EXAMPLE_USAGE}
              lang="text"
            />
          </section>

          {/* NPX INSTALL */}
          <section id="npx">
            <SectionHeader icon={Zap} label="npx Install" title="One Command. Zero Setup." />
            <div className="bg-gradient-to-r from-[hsl(240,10%,6%)] to-[hsl(240,10%,10%)] border border-primary/30 rounded-2xl p-8 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary/20 p-2 rounded-lg">
                  <Terminal size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Install via npx</h3>
                  <p className="text-xs font-mono text-[hsl(0,0%,50%)]">No cloning. No build step. Just run it.</p>
                </div>
              </div>
              <CopyBlock code={NPX_INSTALL} lang="bash" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {[
                  { title: `${MCP_CONFIG.toolCount} Tools`, desc: "Trading, portfolio, market data, GPU clusters, burn economy" },
                  { title: "Streaming AI", desc: `${AI_MODELS[0].name} on ${GPU_CONFIG.label.split(' · ')[0]} via Cloudflare tunnel` },
                  { title: "Base Chain", desc: "On-chain agents, DEX routing, whale tracking, XMTP alerts" },
                ].map(({ title, desc }) => (
                  <div key={title} className="bg-[hsl(240,10%,12%)] border border-[hsl(240,10%,18%)] rounded-xl p-4">
                    <div className="text-sm font-bold text-primary mb-1">{title}</div>
                    <div className="text-xs font-mono text-[hsl(0,0%,50%)]">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="text-sm font-bold text-primary mb-3 font-mono uppercase tracking-wider">Quick Setup</h4>
              <div className="space-y-3 text-sm font-mono text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold shrink-0">1.</span>
                  <span>Run <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">npx montra-mcp-server</code> to verify it starts (you'll see the MONTRA banner)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold shrink-0">2.</span>
                  <span>Add the config to Claude Desktop, Claude Code, or Cursor (see Installation tab below)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold shrink-0">3.</span>
                  <span>Set your env vars — only <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">SUPABASE_URL</code> and <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> are required</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold shrink-0">4.</span>
                  <span>Start chatting — ask Claude to deploy an agent, check prices, or run a backtest</span>
                </div>
              </div>
            </div>
          </section>

          {/* INSTALLATION */}
          <section id="installation">
            <SectionHeader icon={Terminal} label="Installation" title="Connect to Claude" />

            {/* Install tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(["desktop", "code", "cursor", "api"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInstallTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                    installTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "desktop" ? "Claude Desktop" : tab === "code" ? "Claude Code" : tab === "cursor" ? "Cursor" : "Direct API"}
                </button>
              ))}
            </div>

            {installTab === "desktop" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-mono">
                  Add the following to your <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">claude_desktop_config.json</code>:
                </p>
                <CopyBlock code={CLAUDE_DESKTOP_CONFIG} />
              </div>
            )}

            {installTab === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-mono">
                  One-liner to register with Claude Code:
                </p>
                <CopyBlock code={CLAUDE_CODE_CONFIG} lang="bash" />
                <p className="text-sm text-muted-foreground font-mono">
                  Or add to your project's <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">.claude/settings.json</code>:
                </p>
                <CopyBlock
                  code={`{
  "mcpServers": {
    "montra": {
      "command": "npx",
      "args": ["-y", "montra-mcp-server"]
    }
  }
}`}
                />
              </div>
            )}

            {installTab === "cursor" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-mono">
                  Add to your Cursor MCP config at <code className="text-primary bg-secondary px-1.5 py-0.5 rounded">.cursor/mcp.json</code>:
                </p>
                <CopyBlock code={CURSOR_CONFIG} />
              </div>
            )}

            {installTab === "api" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-mono">
                  Run the MCP server directly — no clone needed:
                </p>
                <CopyBlock
                  code={`# Run directly with npx (auto-installs)
npx montra-mcp-server

# Or install globally
npm install -g montra-mcp-server
montra-mcp-server

# The server communicates over stdin/stdout (MCP stdio transport)
# Connect any MCP-compatible client to this process`}
                  lang="bash"
                />
              </div>
            )}

            {/* Env vars table */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-primary mb-4">Environment Variables</h3>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="text-left px-4 py-3 font-mono text-xs text-muted-foreground uppercase tracking-wider">Variable</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-muted-foreground uppercase tracking-wider">Required</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { name: "SUPABASE_URL", req: true, desc: "Supabase project URL" },
                      { name: "SUPABASE_SERVICE_ROLE_KEY", req: true, desc: "Supabase service role key" },
                      { name: "BASE_RPC_URL", req: false, desc: "Base RPC endpoint (defaults to mainnet.base.org)" },
                      { name: "BURN_TOKEN_ADDRESS", req: false, desc: "$MONTRA token contract on Base" },
                      { name: "COINGLASS_KEY", req: false, desc: "Coinglass API key for derivatives data" },
                      { name: "WHALE_ALERT_KEY", req: false, desc: "Whale Alert API key for large txns" },
                      { name: "HELSINKI_BASE", req: false, desc: "Helsinki VM base URL for quant data" },
                      { name: "XMTP_BOT_PRIVATE_KEY", req: false, desc: "Private key for XMTP bot wallet (messaging)" },
                      { name: "XMTP_ENV", req: false, desc: "XMTP network: production or dev" },
                      { name: "NEYNAR_API_KEY", req: false, desc: "Neynar API key for Farcaster posting" },
                      { name: "FARCASTER_SIGNER_UUID", req: false, desc: "Farcaster signer UUID for Montra account" },
                      { name: "VAST_AI_API_KEY", req: false, desc: "Vast.ai API key for GPU cluster management" },
                    ].map(({ name, req, desc }) => (
                      <tr key={name} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-primary text-xs">{name}</td>
                        <td className="px-4 py-3">
                          {req ? (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">Required</span>
                          ) : (
                            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* TOOLS */}
          <section id="tools">
            <SectionHeader icon={Code2} label="Tool Reference" title={`${MCP_CONFIG.toolCount} MCP Tools`} />
            <p className="text-sm text-muted-foreground font-mono mb-8 max-w-3xl">
              Every tool accepts structured input via Zod schemas and returns JSON. Claude can chain tools together for complex multi-step workflows like deploying agents, running risk assessments, and generating P&L reports.
            </p>

            <div className="space-y-12">
              {TOOL_CATEGORIES.map(({ id, label, icon: Icon, tools }) => (
                <div key={id} id={`cat-${id}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-primary">{label}</h3>
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {tools.length} tool{tools.length > 1 ? "s" : ""}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {tools.map(({ name, desc }) => (
                      <div
                        key={name}
                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-primary bg-primary/10 px-2 py-1 rounded font-mono text-sm font-bold shrink-0">
                            {name}
                          </code>
                          <p className="text-sm text-muted-foreground font-mono leading-relaxed pt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* RESOURCES */}
          <section id="resources">
            <SectionHeader icon={Layers} label="Resources" title="5 MCP Resources" />
            <p className="text-sm text-muted-foreground font-mono mb-6 max-w-3xl">
              Static reference data that Claude can read on demand. No API calls — these serve curated platform knowledge for context-aware responses.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {RESOURCES.map(({ uri, desc }) => (
                <div key={uri} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <code className="text-primary bg-primary/10 px-2 py-1 rounded font-mono text-xs font-bold shrink-0">{uri}</code>
                    <p className="text-sm text-muted-foreground font-mono leading-relaxed pt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PROMPTS */}
          <section id="prompts">
            <SectionHeader icon={MessageSquare} label="Workflow Prompts" title="6 Guided Workflows" />
            <p className="text-sm text-muted-foreground font-mono mb-6 max-w-3xl">
              Pre-built prompt templates that walk Claude through multi-step operations. Each prompt chains multiple tools together for comprehensive analysis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PROMPTS.map(({ name, desc }) => (
                <div key={name} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight size={14} className="text-primary" />
                    <code className="text-primary font-mono text-sm font-bold">{name}</code>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ARCHITECTURE */}
          <section id="architecture">
            <SectionHeader icon={GitBranch} label="Architecture" title="How It Works" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">System Architecture</h3>
                <CopyBlock
                  code={`┌─────────────────┐
│   Claude (AI)   │
└────────┬────────┘
         │  MCP Protocol (stdio)
┌────────▼────────┐
│  Montra MCP     │ ← ${MCP_CONFIG.toolCount} tools / ${MCP_CONFIG.resourceCount} resources / ${MCP_CONFIG.promptCount} prompts
│  Server         │
└──┬─────┬─────┬──┘
   │     │     │
   ▼     ▼     ▼
Supabase  Base  External APIs
 (DB)    (RPC)  (DexScreener,
                 Coinglass,
                 Helsinki VM,
                 Whale Alert)`}
                  lang="text"
                />
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Data Flow</h3>
                <div className="space-y-4">
                  {[
                    { icon: Bot, title: "Claude sends tool calls", desc: "Natural language is converted to structured MCP tool invocations" },
                    { icon: Shield, title: "Zod validates input", desc: "Every parameter is validated against strict Zod schemas" },
                    { icon: Globe, title: "Server fetches data", desc: "Supabase queries, Base RPC calls, or external API requests" },
                    { icon: FileText, title: "JSON response returned", desc: "Structured data flows back to Claude for reasoning and display" },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="bg-primary/10 p-1.5 rounded-lg shrink-0 mt-0.5">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{title}</div>
                        <div className="text-xs text-muted-foreground font-mono">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tech stack */}
            <div className="mt-6 bg-card border border-border rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">Tech Stack</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  "TypeScript",
                  "MCP SDK",
                  "Zod",
                  "Supabase",
                  "Base Chain (L2)",
                  "DexScreener API",
                  "Coinglass API",
                  "Helsinki VM",
                  "Whale Alert",
                  "Neynar (Farcaster)",
                  "XMTP (messaging)",
                  "Vast.ai (GPU cluster)",
                  "Vercel Serverless",
                  "ethers.js",
                ].map((tech) => (
                  <div key={tech} className="bg-secondary rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground text-center">
                    {tech}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TIERS */}
          <section id="tiers">
            <SectionHeader icon={Award} label="Tier System" title="$MONTRA Membership Tiers" />
            <p className="text-sm text-muted-foreground font-mono mb-6 max-w-3xl">
              Hold $MONTRA tokens to unlock higher tiers with more agent slots, burn discounts, and exclusive features.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { tier: "DIAMOND", tokens: "5B+", agents: 20, discount: "50%", color: "from-blue-500/20 to-purple-500/20 border-blue-500/30" },
                { tier: "GOLD", tokens: "1B+", agents: 12, discount: "30%", color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30" },
                { tier: "SILVER", tokens: "500M+", agents: 8, discount: "15%", color: "from-gray-400/20 to-gray-300/20 border-gray-400/30" },
                { tier: "BRONZE", tokens: "100M+", agents: 5, discount: "5%", color: "from-orange-500/20 to-orange-400/20 border-orange-500/30" },
              ].map(({ tier, tokens, agents, discount, color }) => (
                <div key={tier} className={`bg-gradient-to-br ${color} border rounded-xl p-5`}>
                  <div className="text-xs font-mono font-bold text-foreground mb-3 tracking-widest">{tier}</div>
                  <div className="space-y-2 text-sm font-mono text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Min Tokens</span>
                      <span className="text-foreground font-semibold">{tokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Agents</span>
                      <span className="text-foreground font-semibold">{agents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Burn Discount</span>
                      <span className="text-foreground font-semibold">{discount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer CTA */}
          <section className="border-t border-border pt-12">
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-semibold text-primary mb-4">Ready to Build?</h2>
              <p className="text-sm text-muted-foreground font-mono mb-6 max-w-lg mx-auto">
                Connect Claude to your Montra MCP server and start trading with AI-powered autonomous agents on Base chain.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  to="/dashboard"
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors font-mono text-sm"
                >
                  Launch Terminal
                </Link>
                <a
                  href="https://github.com/MontraFinance/MontraFinance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-lg border border-border text-primary font-medium hover:bg-secondary transition-colors font-mono text-sm"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

/* ─── Reusable Section Header ─── */
function SectionHeader({ icon: Icon, label, title }: { icon: typeof BookOpen; label: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">{label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-primary">{title}</h2>
    </div>
  );
}

export default DeveloperDocs;
