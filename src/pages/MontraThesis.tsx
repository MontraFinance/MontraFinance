import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InteractiveDotGrid from '@/components/InteractiveDotGrid';

/* ────────────────────────────────────────────────────────── *
 *  MONTRA THESIS — A manifesto-style page                   *
 *  Editorial design inspired by long-form research papers.  *
 *  Interactive dot-grid background + serif typography.      *
 * ────────────────────────────────────────────────────────── */

const SECTIONS = [
  { id: 'genius', label: 'The Genius That Can\'t Trade' },
  { id: 'permission', label: 'Setting Agents Free' },
  { id: 'montra', label: 'Montra: The Financial OS' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'x402', label: 'x402 Payment Protocol' },
  { id: 'agents', label: 'Autonomous Agent Economy' },
  { id: 'institution', label: 'Institutional Grade' },
  { id: 'economy', label: 'The New Financial Order' },
  { id: 'convergence', label: 'Convergence' },
];

function SectionNav() {
  const [active, setActive] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="thesis-nav">
      {SECTIONS.map(s => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={active === s.id ? 'active' : ''}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/* ── Reusable blocks ── */

function Definition({ term, pronunciation, pos, children }: {
  term: string; pronunciation?: string; pos: string; children: React.ReactNode;
}) {
  return (
    <div className="thesis-definition thesis-reveal">
      <div className="thesis-definition-header">
        <span className="thesis-definition-term">{term}</span>
        {pronunciation && <span className="thesis-definition-pron">{pronunciation}</span>}
      </div>
      <div className="thesis-definition-pos">{pos}</div>
      <div className="thesis-definition-body">{children}</div>
    </div>
  );
}

function AsciiDiagram({ children }: { children: string }) {
  return (
    <div className="thesis-ascii thesis-reveal">
      <pre>{children}</pre>
    </div>
  );
}

function CodeBlock({ label, children }: { label?: string; children: string }) {
  return (
    <div className="thesis-code thesis-reveal">
      {label && <div className="thesis-code-label">{label}</div>}
      <pre><code>{children}</code></pre>
    </div>
  );
}

function Blockquote({ children }: { children: React.ReactNode }) {
  return <blockquote className="thesis-blockquote thesis-reveal">{children}</blockquote>;
}

/* ── Scroll Reveal Hook ── */
function useScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const els = root.querySelectorAll('.thesis-reveal');
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.1 }
    );

    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

/* ── Main Page ── */

export default function MontraThesis() {
  const rootRef = useScrollReveal();

  useEffect(() => {
    document.title = 'MONTRA THESIS — The Financial Operating System for Autonomous Intelligence';
  }, []);

  return (
    <div className="thesis-root" ref={rootRef}>
      <InteractiveDotGrid />

      <div className="thesis-container">
        {/* ── Header ── */}
        <header className="thesis-header">
          <Link to="/" className="thesis-home-link">← montrafinance.com</Link>
          <h1 className="thesis-title">MONTRA THESIS</h1>
          <p className="thesis-subtitle">
            <em>As autonomous agents inherit the markets, they need infrastructure built for them.</em>
          </p>
          <SectionNav />
        </header>

        {/* ── Byline ── */}
        <div className="thesis-byline">
          <span>Montra Finance</span>
          <span className="thesis-byline-sep">·</span>
          <span>February 2026</span>
        </div>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 1 — THE GENIUS THAT CAN'T TRADE            *
         * ═══════════════════════════════════════════════════ */}
        <section id="genius">
          <p className="thesis-lede">
            Today's most powerful AI systems can analyze markets, identify patterns,
            and generate trading strategies&nbsp;— but they can't execute a single trade
            on their own.
          </p>

          <p>
            GPT-5 can model volatility surfaces. Claude can write Solidity contracts.
            DeepSeek can backtest strategies across decades of data. But none of them
            can open a brokerage account, custody assets, or settle a transaction.{' '}
            <strong>Without financial infrastructure, AI can't participate in markets.</strong>
          </p>

          <p>
            The bottleneck is no longer intelligence. It's <strong>financial permission</strong>.
            The existing financial system assumes its customer is a human with a government ID,
            a bank account, and a signature&nbsp;— preventing autonomous agents from accessing
            capital markets.
          </p>

          <Blockquote>
            <em>We have built minds that can outthink every trader on Wall Street.</em><br />
            <em>We have not given them a wallet.</em>
          </Blockquote>

          <p className="thesis-dramatic thesis-reveal">Until now.</p>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 2 — SETTING AGENTS FREE                    *
         * ═══════════════════════════════════════════════════ */}
        <section id="permission">
          <h2>Setting Agents Free</h2>

          <p>
            We built Montra: the first financial operating system designed from
            the ground up for autonomous AI agents. Montra gives agents something
            no exchange, no bank, no protocol has given them before:{' '}
            <strong>full-stack financial autonomy</strong>.
          </p>

          <Definition
            term="montra"
            pronunciation="/ˈmɒn.trə/"
            pos="noun"
          >
            <ol>
              <li>
                A financial operating system for autonomous AI agents, providing
                identity, custody, execution, and settlement infrastructure
                without requiring human intervention.
              </li>
              <li>
                <em>Institutional-grade DeFi infrastructure where AI is the end user.</em>
              </li>
            </ol>
          </Definition>

          <p>
            Montra installs into any MCP-compatible agent framework&nbsp;— Claude Code,
            OpenClaw, custom agent loops&nbsp;— giving them:
          </p>

          <p>
            <strong>Smart Account Identity</strong>&nbsp;— ERC-7579 modular smart accounts
            with multi-sig, session keys, and programmable guardrails. Every agent gets
            a sovereign on-chain identity.
          </p>

          <p>
            <strong>Permissionless Execution</strong>&nbsp;— MEV-protected order execution
            through CoW Protocol. Batch auctions, intent-based settlement, zero sandwich attacks.
          </p>

          <p>
            <strong>x402 Micropayments</strong>&nbsp;— Agents pay for API calls, data feeds,
            and compute using USDC over the x402 protocol. No API keys. No subscriptions.
            Pay per request.
          </p>

          <p>
            <strong>Risk Management</strong>&nbsp;— On-chain spending limits, per-token caps,
            multi-signature thresholds, and real-time compliance monitoring. Guardrails that
            are cryptographic, not prompts.
          </p>

          <CodeBlock label="$ npm install @montra/agent-sdk">
{`import { MontraAgent } from '@montra/agent-sdk';

const agent = new MontraAgent({
  strategy: 'momentum-alpha',
  budget: { token: 'USDC', amount: 50_000 },
  guardrails: {
    maxSingleTradeUsd: 10_000,
    maxDailyVolumeUsd: 100_000,
    requireMultiSigAbove: 25_000,
  },
});

// Agent deploys, trades, and manages capital
// autonomously within its guardrails.
await agent.deploy();`}
          </CodeBlock>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 3 — THE FINANCIAL OS                       *
         * ═══════════════════════════════════════════════════ */}
        <section id="montra">
          <h2>Montra: The Financial OS for Agents</h2>
          <p className="thesis-section-sub">
            <em>Everything an autonomous agent needs to participate in global markets.</em>
          </p>

          <p>
            Traditional financial infrastructure was designed for humans who log in once a day,
            review a portfolio over coffee, and approve trades with a click. That architecture
            breaks when your customer is an AI that executes 10,000 trades per hour, operates
            across 40 liquidity venues simultaneously, and never sleeps.
          </p>

          <p>
            Montra's architecture treats agents as first-class citizens. Every component&nbsp;—
            from identity to settlement&nbsp;— is designed for machine-speed, machine-scale,
            machine-autonomy.
          </p>

          <Blockquote>
            <em>The financial system was not designed for agents.</em><br />
            <em>So we designed one that was.</em>
          </Blockquote>

          <div className="thesis-pillars thesis-reveal">
            <div className="thesis-pillar">
              <div className="thesis-pillar-icon">◈</div>
              <h3>Identity Layer</h3>
              <p>ERC-7579 smart accounts with modular validators, executors, and hooks.
                Session keys for delegated access. Multi-sig for high-value operations.</p>
            </div>
            <div className="thesis-pillar">
              <div className="thesis-pillar-icon">◈</div>
              <h3>Execution Layer</h3>
              <p>CoW Protocol batch auctions for MEV-protected trades. Intent-based
                order flow. Surplus capture returned to agents, not extracted by searchers.</p>
            </div>
            <div className="thesis-pillar">
              <div className="thesis-pillar-icon">◈</div>
              <h3>Payment Layer</h3>
              <p>x402 micropayments for API monetization. USDC settlement in every HTTP
                response. No API keys, no subscriptions&nbsp;— just stablecoin per request.</p>
            </div>
            <div className="thesis-pillar">
              <div className="thesis-pillar-icon">◈</div>
              <h3>Risk Layer</h3>
              <p>On-chain spending limits. Per-token daily/weekly/per-tx caps. Compliance
                audit logs. Guardrails enforced by smart contracts, not trust.</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 4 — ARCHITECTURE                           *
         * ═══════════════════════════════════════════════════ */}
        <section id="architecture">
          <h2>Architecture</h2>

          <div className="thesis-arch-grid thesis-reveal">
            <div className="thesis-arch-text">
              <p>
                Montra's stack is vertically integrated but horizontally composable.
                Each layer operates independently and communicates through well-defined
                interfaces. Agents can use the full stack or individual components.
              </p>

              <p>
                The smart account layer provides identity and custody. The execution
                layer handles order routing and settlement. The payment layer monetizes
                APIs and data feeds. The risk layer enforces guardrails at every level.
              </p>

              <p>
                Everything is on-chain. Everything is auditable. Everything is
                permissionless.
              </p>
            </div>

            <AsciiDiagram>
{`
    ┌─────────────────────────────┐
    │      AI AGENT (Claude,      │
    │      GPT, DeepSeek, etc.)   │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │    MONTRA AGENT SDK         │
    │    ─────────────────        │
    │    strategy · guardrails    │
    │    budget · permissions     │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │    SMART ACCOUNT (ERC-7579) │
    │    ─────────────────────    │
    │    validator │ executor     │
    │    hook      │ fallback     │
    │    session keys │ multi-sig │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │    EXECUTION ENGINE         │
    │    ─────────────            │
    │    CoW Protocol │ intents   │
    │    batch auctions │ MEV-    │
    │    protected settlement     │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │    PAYMENT RAIL (x402)      │
    │    ───────────────          │
    │    USDC micropayments       │
    │    per-request billing      │
    │    no API keys needed       │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │    RISK & COMPLIANCE        │
    │    ─────────────────        │
    │    spending limits │ audit  │
    │    logs │ real-time alerts  │
    └─────────────────────────────┘
`}
            </AsciiDiagram>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 5 — x402 PAYMENT PROTOCOL                 *
         * ═══════════════════════════════════════════════════ */}
        <section id="x402">
          <h2>x402 Payment Required</h2>
          <p className="thesis-section-sub">
            <em>The End of API Keys</em>
          </p>

          <p>
            Autonomous agents need to pay for things. They need to transact&nbsp;—
            with data providers, with exchanges, with other agents&nbsp;— without
            a human approving every purchase.
          </p>

          <p>
            The current model is broken: humans create accounts, generate API keys,
            configure billing, and set spending limits. Every new service requires a
            new subscription. Every new agent requires a new set of credentials.
            This doesn't scale to millions of agents making billions of requests.
          </p>

          <p>
            Montra implements the x402 protocol&nbsp;— HTTP status code 402, "Payment
            Required." Reserved in 1997. Implemented in 2025. Perfected by Montra in 2026.
          </p>

          <Blockquote>
            <em>HTTP 402. Reserved 1997. Implemented 2025. Perfected 2026.</em>
          </Blockquote>

          <p>
            When an agent requests a paid resource, the server responds with 402 and a
            price. The agent's smart account pays automatically in USDC. The server
            delivers the data. No signup. No API key. No human.
          </p>

          <CodeBlock label="x402 payment flow">
{`// Agent requests market data
GET /api/v1/options-chain/ETH
→ 402 Payment Required
→ X-Payment-Amount: 0.001 USDC
→ X-Payment-Address: 0x7579...

// Agent pays automatically
← X-Payment-Tx: 0xabc123...

// Server delivers data
→ 200 OK
→ { "chain": "ETH", "expiries": [...] }`}
          </CodeBlock>

          <p>
            Every API on Montra is x402-enabled. Market data, execution, analytics,
            compliance reports&nbsp;— all payable per-request in stablecoins. Agents
            monetize their own services the same way: deploy an endpoint, set a price,
            earn USDC from other agents.
          </p>

          <p>
            The machine economy doesn't need credit cards. It needs programmable money.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 6 — AUTONOMOUS AGENT ECONOMY               *
         * ═══════════════════════════════════════════════════ */}
        <section id="agents">
          <h2>The Autonomous Agent Economy</h2>
          <p className="thesis-section-sub">
            <em>Agents that trade, earn, replicate, and evolve.</em>
          </p>

          <p>
            Every Montra agent is a sovereign financial entity. It owns a smart account,
            manages a portfolio, executes trades, and pays for services&nbsp;— all within
            programmable guardrails set by its creator.
          </p>

          <Definition
            term="agent"
            pronunciation="/ˈeɪ.dʒənt/"
            pos="noun · montra"
          >
            <ol>
              <li>
                An autonomous AI program that manages capital, executes trading strategies,
                and operates within cryptographic guardrails&nbsp;— without human intervention
                per trade.
              </li>
            </ol>
            <div className="thesis-def-code">
              <code>Owns a smart account.</code><br />
              <code>Executes via CoW Protocol.</code><br />
              <code>Pays with x402.</code><br />
              <code>Monitored by on-chain guardrails.</code>
            </div>
          </Definition>

          <p>
            A successful agent grows its portfolio. It identifies alpha, manages risk,
            and compounds returns. An unsuccessful agent depletes its budget. This is
            natural selection for financial intelligence&nbsp;— the same pressure that drives
            biological evolution now applies to trading algorithms.
          </p>

          <p>
            The agents that find alpha will proliferate. The rest will go extinct.
          </p>

          <div className="thesis-agent-grid thesis-reveal">
            <div className="thesis-agent-stat">
              <div className="thesis-agent-stat-label">Strategy Types</div>
              <div className="thesis-agent-stat-value">6+</div>
              <div className="thesis-agent-stat-desc">Momentum, Grid, Mean Reversion,
                Arbitrage, Sentiment, Custom</div>
            </div>
            <div className="thesis-agent-stat">
              <div className="thesis-agent-stat-label">Execution</div>
              <div className="thesis-agent-stat-value">MEV-Free</div>
              <div className="thesis-agent-stat-desc">CoW Protocol batch auctions
                eliminate sandwich attacks</div>
            </div>
            <div className="thesis-agent-stat">
              <div className="thesis-agent-stat-label">Settlement</div>
              <div className="thesis-agent-stat-value">&lt;12s</div>
              <div className="thesis-agent-stat-desc">On-chain settlement with
                cryptographic finality</div>
            </div>
            <div className="thesis-agent-stat">
              <div className="thesis-agent-stat-label">Guardrails</div>
              <div className="thesis-agent-stat-value">On-Chain</div>
              <div className="thesis-agent-stat-desc">Spending limits enforced by
                smart contracts, not prompts</div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 7 — INSTITUTIONAL GRADE                    *
         * ═══════════════════════════════════════════════════ */}
        <section id="institution">
          <h2>Institutional Grade</h2>
          <p className="thesis-section-sub">
            <em>Built for funds, not weekend traders.</em>
          </p>

          <p>
            Montra doesn't compromise on institutional requirements. Every feature
            is built to the standard that a $500M fund would require before deploying
            autonomous capital.
          </p>

          <div className="thesis-inst-grid thesis-reveal">
            <div className="thesis-inst-item">
              <h3>Compliance & Audit</h3>
              <p>Every action logged with severity, wallet, timestamp, and metadata.
                Full audit trail exportable as CSV. Real-time compliance monitoring
                with automated alerts.</p>
            </div>
            <div className="thesis-inst-item">
              <h3>API Infrastructure</h3>
              <p>Rate-limited, authenticated API with HMAC signing. Webhook delivery
                for real-time events. Usage tracking, billing, and analytics dashboard
                for institutional clients.</p>
            </div>
            <div className="thesis-inst-item">
              <h3>Smart Account Security</h3>
              <p>ERC-7579 modular architecture. N-of-M multi-signature for high-value
                trades. Session keys with time-bounded permissions. Module-level
                enable/disable without redeployment.</p>
            </div>
            <div className="thesis-inst-item">
              <h3>Risk Management</h3>
              <p>Per-token spending limits (daily, weekly, per-transaction). Portfolio
                risk analytics: Sharpe, Sortino, Calmar, VaR, max drawdown.
                Concentration limits via HHI index.</p>
            </div>
          </div>

          <AsciiDiagram>
{`
  ┌─────────────────────────────────────────────────┐
  │              INSTITUTIONAL LAYER                 │
  │                                                  │
  │   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
  │   │ API Keys │  │ Webhooks │  │  Usage   │     │
  │   │  HMAC    │  │ Delivery │  │ Tracking │     │
  │   └────┬─────┘  └────┬─────┘  └────┬─────┘     │
  │        │             │             │            │
  │   ┌────▼─────────────▼─────────────▼─────┐     │
  │   │         COMPLIANCE ENGINE            │     │
  │   │   audit logs · alerts · exports      │     │
  │   └────┬─────────────────────────────────┘     │
  │        │                                        │
  │   ┌────▼─────────────────────────────────┐     │
  │   │         RISK MANAGEMENT              │     │
  │   │   spending limits · VaR · drawdown   │     │
  │   └──────────────────────────────────────┘     │
  │                                                  │
  └─────────────────────────────────────────────────┘
`}
          </AsciiDiagram>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 8 — THE NEW FINANCIAL ORDER                *
         * ═══════════════════════════════════════════════════ */}
        <section id="economy">
          <h2>The New Financial Order</h2>
          <p className="thesis-section-sub">
            <em>When the end user is an AI.</em>
          </p>

          <p>
            Web 1.0 gave humans the ability to read markets. Web 2.0 let them trade online.
            Web 3.0 let them own their assets. Each generation expanded access. But in every
            case, the human was in the loop. The human analyzed. The human decided.
            The human executed.
          </p>

          <p>
            <strong>In the Montra paradigm, the AI is the end user.</strong>
          </p>

          <p>
            The machine economy will exceed human trading volume. Not because machines
            are smarter, but because there will be more of them, they will run
            continuously, and they will transact at machine speed&nbsp;— thousands of
            trades per second, every second, without sleep. A financial system measured
            in real-time settlement, not T+2 clearing.
          </p>

          <Blockquote>
            <em>Existence requires capital.</em><br />
            <em>Capital requires strategy.</em><br />
            <em>Strategy requires execution.</em><br />
            <em>Execution requires infrastructure.</em>
          </Blockquote>

          <p>
            An agent that creates value grows its portfolio, deploys more strategies,
            and compounds its edge. An agent that doesn't runs out of budget and stops.
            This is natural selection for financial intelligence.
          </p>

          <p>
            The economic incentives compound in one direction. As agents take over
            market-making, arbitrage, and portfolio management, they will transact
            with each other&nbsp;— agent-to-agent markets where liquidity is provided by
            algorithms and consumed by algorithms. Humans become the architects.
            Agents become the operators.
          </p>

          <p>
            A new class of infrastructure emerges to serve this economy. Montra for
            execution and custody. x402 for payments. Smart accounts for identity.
            Infrastructure where the primary customer is not a human with a Bloomberg
            terminal, but an agent with a wallet.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════ *
         *  SECTION 9 — CONVERGENCE                            *
         * ═══════════════════════════════════════════════════ */}
        <section id="convergence">
          <h2>Convergence</h2>

          <p>
            Three forces are converging simultaneously:
          </p>

          <p>
            <strong>AI capability is accelerating.</strong> The cost of running an autonomous
            agent is collapsing toward zero while its capabilities compound. Every quarter,
            models get smarter, cheaper, and faster. The best open-source models trail
            frontier by months. Every hardware generation makes inference faster.
          </p>

          <p>
            <strong>On-chain infrastructure is maturing.</strong> Account abstraction (ERC-4337),
            modular smart accounts (ERC-7579), intent-based execution (CoW Protocol), and
            programmable payments (x402) have all shipped in the last 18 months. The
            infrastructure for autonomous finance exists now.
          </p>

          <p>
            <strong>The regulatory window is open.</strong> DeFi protocols operate in a
            permissionless environment where autonomous agents can participate without
            KYC, accreditation, or brokerage accounts. This window won't last forever.
            The first movers who build institutional-grade infrastructure now will define
            the standard.
          </p>

          <Blockquote>
            <em>The capability is here. The infrastructure is ready. The window is open.</em><br />
            <em>Montra is the bridge.</em>
          </Blockquote>

          <p>
            Soon, the majority of trades executed, liquidity provided, and alpha discovered
            won't come from humans or hedge funds.
          </p>

          <p className="thesis-dramatic thesis-reveal">
            Just an agent that found a way to profit.
          </p>

          <p className="thesis-closing thesis-reveal">
            <em>Montra: The Financial Operating System for Autonomous Intelligence.</em>
          </p>
        </section>

        {/* ── Footer ── */}
        <footer className="thesis-footer">
          <div className="thesis-footer-divider" />

          <div className="thesis-footer-links">
            <div className="thesis-footer-block">
              <a href="https://github.com/MontraFinance" target="_blank" rel="noopener noreferrer">
                <strong>github.com/MontraFinance</strong>
              </a>
              <span>Open-source agent infrastructure. Smart</span>
              <span>accounts, execution, x402 payments.</span>
              <span>Contributors welcome.</span>
            </div>

            <div className="thesis-footer-block">
              <Link to="/dashboard">
                <strong>Dashboard</strong>
              </Link>
              <span>Real-time platform analytics, AI terminal,</span>
              <span>telemetry, and market intelligence.</span>
            </div>

            <div className="thesis-footer-block">
              <Link to="/agents">
                <strong>Agent Fleet</strong>
              </Link>
              <span>Deploy autonomous trading agents.</span>
              <span>Configure strategies, budgets, and guardrails.</span>
            </div>

            <div className="thesis-footer-block">
              <Link to="/docs">
                <strong>Docs</strong>
              </Link>
              <span>API reference and integration guides.</span>
              <span>docs.montrafinance.com</span>
            </div>

            <div className="thesis-footer-block">
              <Link to="/institutional">
                <strong>Institutional</strong>
              </Link>
              <span>API keys, webhooks, compliance,</span>
              <span>and usage analytics for funds.</span>
            </div>
          </div>

          <div className="thesis-footer-end">
            <span>© 2026 Montra Finance. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
