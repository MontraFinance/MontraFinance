import {
  Code2, Bot, PieChart, Shield, Flame, ExternalLink,
  Terminal, Zap, ArrowRight, Copy, Check,
} from 'lucide-react';
import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';

// ── Helpers ──

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>{children}</div>
);

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon size={14} className="text-primary" />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-muted-foreground hover:text-foreground transition"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

// ── Data ──

const FEATURED_INTEGRATIONS = [
  {
    name: 'MCP Server',
    description: '43 MCP tools for Claude Desktop & Claude Code. Portfolio analysis, agent management, burn analytics, and more.',
    category: 'AI Agent',
    icon: Terminal,
    status: 'live' as const,
    url: 'https://github.com/MontraFinance/MontraFinance',
  },
  {
    name: 'Portfolio Recomposer',
    description: 'AI-driven portfolio allocation engine. Analyzes risk tolerance and market conditions to generate strategy recommendations.',
    category: 'DeFi',
    icon: PieChart,
    status: 'live' as const,
    url: null,
  },
  {
    name: 'Agent Fleet API',
    description: 'Deploy, manage, and monitor autonomous trading agents. Full lifecycle control via REST endpoints.',
    category: 'Trading',
    icon: Bot,
    status: 'live' as const,
    url: null,
  },
  {
    name: 'Burn Analytics',
    description: 'Aggregated $MONTRA burn statistics, wallet history, complexity breakdowns, and deflationary metrics.',
    category: 'Analytics',
    icon: Flame,
    status: 'live' as const,
    url: null,
  },
  {
    name: 'Compliance & Audit',
    description: 'Institutional-grade audit trail, usage metrics, report generation, and CSV export for regulatory compliance.',
    category: 'Institutional',
    icon: Shield,
    status: 'live' as const,
    url: null,
  },
  {
    name: 'Smart Accounts',
    description: 'ERC-7579 modular smart account configuration. Session keys, spending limits, and guardrail policies.',
    category: 'Infrastructure',
    icon: Zap,
    status: 'live' as const,
    url: null,
  },
];

const TIER_DISCOUNTS = [
  { tier: 'Diamond', tokens: '5B+ MONTRA', discount: '50%', color: 'text-cyan-300' },
  { tier: 'Gold', tokens: '1B+ MONTRA', discount: '30%', color: 'text-yellow-400' },
  { tier: 'Silver', tokens: '500M+ MONTRA', discount: '15%', color: 'text-slate-300' },
  { tier: 'Bronze', tokens: '100M+ MONTRA', discount: '5%', color: 'text-orange-400' },
];

const CURL_EXAMPLE = `curl -X GET https://montrafinance.com/api/tiers/check?wallet=0xYOUR_WALLET

# Response: 402 Payment Required
# {
#   "x402Version": 2,
#   "paymentRequirements": {
#     "scheme": "exact",
#     "network": "eip155:8453",
#     "maxAmountRequired": "10000",
#     "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
#     "payTo": "0x9B767bD2895DE4154195124EF091445F6daa8337"
#   }
# }`;

const SDK_EXAMPLE = `import { paymentMiddleware } from '@x402/client';

const response = await fetch(
  'https://montrafinance.com/api/portfolio/recompose',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wallet-Address': '0xYOUR_WALLET', // for tier discount
    },
    body: JSON.stringify({
      walletAddress: '0xYOUR_WALLET',
      totalValueUsd: 10000,
      riskTolerance: 'moderate',
    }),
    // @x402/client handles 402 → sign → retry automatically
    ...paymentMiddleware({ wallet: yourSigner }),
  }
);`;

// ── Main Page ──

export default function DevShowcase() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activePage="dev-showcase" />

      <div className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code2 size={18} className="text-primary" />
              <span className="text-sm font-bold font-mono">Dev Showcase</span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                x402 PROTOCOL
              </span>
            </div>
            <div className="flex items-center gap-3">
              <TierBadge />
              <ConnectWalletButton />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          {/* ── Hero ── */}
          <DashboardCard className="border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold font-mono mb-2">Build on Montra's Intelligence Layer</h2>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed max-w-xl">
                  Montra Finance exposes AI-powered DeFi intelligence via the x402 micropayment protocol.
                  External consumers pay per-call in USDC on Base. $MONTRA holders get tier-based discounts.
                  No API keys needed — just send a payment header.
                </p>
              </div>
              <a
                href="/api/x402/info"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-mono font-bold hover:opacity-90 transition shrink-0"
              >
                View API Docs <ExternalLink size={12} />
              </a>
            </div>
          </DashboardCard>

          {/* ── Featured Integrations ── */}
          <div>
            <SectionHeader icon={Zap} title="Available Integrations" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURED_INTEGRATIONS.map((integration) => (
                <DashboardCard key={integration.name} className="hover:border-primary/30 transition group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <integration.icon size={16} className="text-primary" />
                      <span className="text-sm font-bold font-mono">{integration.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {integration.category}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500">
                        {integration.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono leading-relaxed mb-3">
                    {integration.description}
                  </p>
                  {integration.url && (
                    <a
                      href={integration.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary font-mono hover:underline"
                    >
                      View on GitHub <ExternalLink size={10} />
                    </a>
                  )}
                </DashboardCard>
              ))}
            </div>
          </div>

          {/* ── Getting Started ── */}
          <div>
            <SectionHeader icon={Terminal} title="Getting Started" />
            <div className="space-y-4">
              {/* Step 1 */}
              <DashboardCard>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">
                    STEP 1
                  </span>
                  <span className="text-xs font-mono font-bold">Call any endpoint — get a 402 response</span>
                </div>
                <div className="relative">
                  <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/50 rounded-lg p-3 overflow-x-auto">
                    {CURL_EXAMPLE}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={CURL_EXAMPLE} />
                  </div>
                </div>
              </DashboardCard>

              {/* Step 2 */}
              <DashboardCard>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">
                    STEP 2
                  </span>
                  <span className="text-xs font-mono font-bold">Sign a USDC payment and resend</span>
                </div>
                <div className="relative">
                  <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/50 rounded-lg p-3 overflow-x-auto">
                    {SDK_EXAMPLE}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={SDK_EXAMPLE} />
                  </div>
                </div>
              </DashboardCard>

              {/* Step 3: Flow summary */}
              <DashboardCard>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">
                    FLOW
                  </span>
                  <span className="text-xs font-mono font-bold">How x402 micropayments work</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1.5 rounded bg-secondary">Call API</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="px-3 py-1.5 rounded bg-secondary">402 + Requirements</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="px-3 py-1.5 rounded bg-secondary">Sign USDC Payment</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="px-3 py-1.5 rounded bg-secondary">X-PAYMENT Header</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="px-3 py-1.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                    API Response
                  </span>
                </div>
              </DashboardCard>
            </div>
          </div>

          {/* ── Tier Discounts ── */}
          <div>
            <SectionHeader icon={Shield} title="$MONTRA Tier Discounts" />
            <DashboardCard>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Include an <code className="text-primary">X-Wallet-Address</code> header with your $MONTRA-holding wallet to get automatic discounts on all API calls.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TIER_DISCOUNTS.map((t) => (
                  <div key={t.tier} className="bg-secondary/30 rounded-lg p-3 text-center">
                    <p className={`text-sm font-bold font-mono ${t.color}`}>{t.tier}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">{t.tokens}</p>
                    <p className="text-lg font-bold font-mono text-green-500 mt-1">{t.discount} off</p>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </div>

          {/* ── Links ── */}
          <div className="flex flex-wrap gap-3 justify-center pb-8">
            <a
              href="https://github.com/MontraFinance/MontraFinance"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-xs font-mono hover:bg-secondary/80 transition"
            >
              GitHub <ExternalLink size={10} />
            </a>
            <a
              href="https://www.x402.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-xs font-mono hover:bg-secondary/80 transition"
            >
              x402 Spec <ExternalLink size={10} />
            </a>
            <a
              href="https://x.com/MontraFinance"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-xs font-mono hover:bg-secondary/80 transition"
            >
              Twitter <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
