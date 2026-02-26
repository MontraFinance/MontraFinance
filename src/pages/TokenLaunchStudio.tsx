import { useState, useCallback } from 'react';
import { Rocket, CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink, Loader2, ImageIcon, Info } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useWallet } from '@/contexts/WalletContext';

const TIMEOUT_MS = 15000;

// ── Types ──

interface PreviewChecks {
  syntax: boolean;
  fields: boolean;
  tickerAvailable: boolean;
  imageValid: boolean;
}

interface PreviewParsed {
  name?: string;
  symbol?: string;
  wallet?: string;
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
}

interface PreviewResponse {
  valid: boolean;
  parsed: PreviewParsed;
  errors: string[];
  warnings: string[];
  checks: PreviewChecks;
}

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

function CheckRow({ label, passed, pending }: { label: string; passed: boolean | null; pending?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {pending ? (
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
      ) : passed === null ? (
        <div className="w-3.5 h-3.5 rounded-full border border-border" />
      ) : passed ? (
        <CheckCircle size={14} className="text-green-500" />
      ) : (
        <XCircle size={14} className="text-red-500" />
      )}
      <span className={`text-xs font-mono ${passed === false ? 'text-red-500' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

// ── API call ──

async function validateLaunch(content: string): Promise<PreviewResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('/api/proxy/clawnch-preview', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Validation failed (${res.status}): ${text}`);
    }
    return (await res.json()) as PreviewResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Publish platforms ──

const PLATFORMS = [
  { name: 'Moltbook', url: 'https://www.moltbook.com/m/clawnch', desc: 'Post to m/clawnch submolt' },
  { name: '4claw', url: 'https://www.4claw.org/b/crypto', desc: 'Post to /crypto/ board' },
  { name: 'Moltx', url: 'https://moltx.io', desc: 'Post anywhere with !clawnch' },
];

// ── Main Component ──

export default function TokenLaunchStudio() {
  const { connected, fullWalletAddress } = useWallet();

  // Form state
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [wallet, setWallet] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');

  // Validation state
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<'idle' | 'deploying' | 'success' | 'failed'>('idle');
  const [deployResult, setDeployResult] = useState<{ tokenAddress: string; txHash: string } | null>(null);
  const [deployError, setDeployError] = useState('');

  // Auto-fill wallet from connected address
  const handleAutoFillWallet = useCallback(() => {
    if (fullWalletAddress) setWallet(fullWalletAddress);
  }, [fullWalletAddress]);

  // Build the !clawnch post content
  const buildPostContent = useCallback(() => {
    let content = '!clawnch';
    if (name) content += `\nname: ${name}`;
    if (symbol) content += `\nsymbol: ${symbol}`;
    if (wallet) content += `\nwallet: ${wallet}`;
    if (description) content += `\ndescription: ${description}`;
    if (imageUrl) content += `\nimage: ${imageUrl}`;
    if (website) content += `\nwebsite: ${website}`;
    if (twitter) content += `\ntwitter: ${twitter}`;
    return content;
  }, [name, symbol, wallet, description, imageUrl, website, twitter]);

  // Validate
  const handleValidate = useCallback(async () => {
    setValidating(true);
    setError('');
    setResult(null);

    try {
      const content = buildPostContent();
      const res = await validateLaunch(content);
      // Ensure arrays exist — Clawnch API may omit them
      setResult({
        ...res,
        errors: res.errors || [],
        warnings: res.warnings || [],
        checks: res.checks || { syntax: false, fields: false, tickerAvailable: false, imageValid: false },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [buildPostContent]);

  // Copy post to clipboard
  const handleCopy = useCallback(async () => {
    const content = buildPostContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildPostContent]);

  const hasRequiredFields = name && symbol && wallet && description && imageUrl;

  // Deploy directly via MontraFi agent
  const handleDeploy = useCallback(async () => {
    if (!hasRequiredFields) return;
    setDeploying(true);
    setDeployStep('deploying');
    setDeployError('');
    setDeployResult(null);

    try {
      const res = await fetch('/api/agents/token-factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, symbol, wallet, description, imageUrl, website, twitter }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || `Deployment failed (${res.status})`);
      }

      const data = await res.json();
      setDeployResult({ tokenAddress: data.tokenAddress, txHash: data.txHash });
      setDeployStep('success');
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
      setDeployStep('failed');
    } finally {
      setDeploying(false);
    }
  }, [name, symbol, wallet, description, imageUrl, website, twitter, hasRequiredFields]);

  // Reset
  const handleReset = useCallback(() => {
    setName('');
    setSymbol('');
    setWallet('');
    setDescription('');
    setImageUrl('');
    setWebsite('');
    setTwitter('');
    setResult(null);
    setError('');
    setDeployStep('idle');
    setDeployResult(null);
    setDeployError('');
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activePage="launch-studio" />

      <div className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rocket size={18} className="text-primary" />
              <span className="text-sm font-bold font-mono">Token Launch Studio</span>
              <span className="text-[10px] text-muted-foreground font-mono">via Clawnch</span>
            </div>
            <div className="flex items-center gap-3">
              <TierBadge />
              <ConnectWalletButton />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-4xl mx-auto">

          {/* ── Info Banner ── */}
          <DashboardCard className="border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-mono text-foreground">
                  Build and validate your <span className="text-primary font-bold">!clawnch</span> token launch post before publishing.
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Clawnch deploys ERC-20 tokens on Base via Clanker with Uniswap v4 liquidity pools.
                  You earn 80% of trading fees forever. Tokens are limited to 1 launch per agent per 24 hours.
                </p>
              </div>
            </div>
          </DashboardCard>

          {/* ── Section 1: Launch Form ── */}
          <div>
            <SectionHeader icon={Rocket} title="Token Details" />
            <DashboardCard>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nexus Protocol"
                    maxLength={100}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground mt-1 block">Max 100 characters</span>
                </div>

                {/* Symbol */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Symbol / Ticker <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="e.g. NEXUS"
                    maxLength={32}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground mt-1 block">Uppercase letters and numbers only</span>
                </div>

                {/* Wallet */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Fee Wallet Address <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      placeholder="0x..."
                      maxLength={42}
                      className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                    />
                    {connected && fullWalletAddress && (
                      <button
                        onClick={handleAutoFillWallet}
                        className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-mono font-bold hover:bg-primary/20 transition whitespace-nowrap"
                      >
                        Use Connected
                      </button>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground mt-1 block">Base address that receives 80% of trading fees</span>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your token..."
                    maxLength={1000}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition resize-none"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground mt-1 block">{description.length}/1000 characters</span>
                </div>

                {/* Image */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Image URL <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3 items-start">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://iili.io/example.jpg"
                      className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                    />
                    {imageUrl && (
                      <div className="w-12 h-12 rounded-lg border border-border overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt="preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <ImageIcon size={16} className="text-muted-foreground hidden" />
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground mt-1 block">Direct link to .jpg, .png, or .webp image</span>
                </div>

                {/* Website (optional) */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Website <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourproject.com"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                </div>

                {/* Twitter (optional) */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Twitter / X <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleValidate}
                  disabled={!hasRequiredFields || validating}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-mono font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {validating ? (
                    <><Loader2 size={14} className="animate-spin" /> Validating...</>
                  ) : (
                    <><CheckCircle size={14} /> Validate Launch</>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-mono text-muted-foreground hover:bg-secondary/80 transition"
                >
                  Reset
                </button>
              </div>
            </DashboardCard>
          </div>

          {/* ── Error ── */}
          {error && (
            <DashboardCard className="border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-red-500" />
                <span className="text-xs font-mono text-red-500">{error}</span>
              </div>
            </DashboardCard>
          )}

          {/* ── Section 2: Validation Results ── */}
          {result && (
            <div>
              <SectionHeader icon={CheckCircle} title="Validation Results" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Checks */}
                <DashboardCard>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3 block">Checks</span>
                  <CheckRow label="Syntax — !clawnch format valid" passed={result.checks.syntax} />
                  <CheckRow label="Fields — all required fields present" passed={result.checks.fields} />
                  <CheckRow label="Ticker — symbol is available" passed={result.checks.tickerAvailable} />
                  <CheckRow label="Image — URL is accessible" passed={result.checks.imageValid} />

                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      {result.valid ? (
                        <>
                          <CheckCircle size={16} className="text-green-500" />
                          <span className="text-sm font-mono font-bold text-green-500">Ready to Launch</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} className="text-red-500" />
                          <span className="text-sm font-mono font-bold text-red-500">Not Ready</span>
                        </>
                      )}
                    </div>
                  </div>
                </DashboardCard>

                {/* Errors & Warnings */}
                <DashboardCard>
                  {result.errors.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-2 block">Errors</span>
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 py-1">
                          <XCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                          <span className="text-xs font-mono text-red-500">{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.warnings.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest mb-2 block">Warnings</span>
                      {result.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 py-1">
                          <AlertTriangle size={12} className="text-orange-400 mt-0.5 shrink-0" />
                          <span className="text-xs font-mono text-orange-400">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.errors.length === 0 && result.warnings.length === 0 && (
                    <div className="flex items-center gap-2 py-4">
                      <CheckCircle size={14} className="text-green-500" />
                      <span className="text-xs font-mono text-muted-foreground">No errors or warnings</span>
                    </div>
                  )}
                </DashboardCard>
              </div>
            </div>
          )}

          {/* ── Section 3: Deploy Now ── */}
          {result?.valid && (
            <div>
              <SectionHeader icon={Rocket} title="Deploy Token" />
              <DashboardCard className="border-primary/20">
                {deployStep === 'success' && deployResult ? (
                  <div className="py-6 text-center">
                    <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
                    <p className="text-sm font-mono font-bold text-green-500">Token Deployed!</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-2">
                      ${symbol} is live on Base with Uniswap v4 liquidity
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">Token:</span>
                        <a
                          href={`https://basescan.org/address/${deployResult.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          {deployResult.tokenAddress.slice(0, 10)}...{deployResult.tokenAddress.slice(-6)}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">Tx:</span>
                        <a
                          href={`https://basescan.org/tx/${deployResult.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          {deployResult.txHash.slice(0, 10)}...{deployResult.txHash.slice(-6)}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : deployStep === 'deploying' ? (
                  <div className="py-6 text-center">
                    <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm font-mono font-bold text-primary">Deploying Token...</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      Creating ERC-20 + Uniswap v4 pool on Base. This may take 15-30 seconds.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-4">
                      Deploy ${symbol} directly to Base via MontraFi agent. Creates a Uniswap v4 pool
                      with MEV protection. LP fees feed back into the $MONTRA buyback flywheel.
                    </p>
                    {deployError && (
                      <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                        <XCircle size={14} className="text-red-500 shrink-0" />
                        <span className="text-[10px] font-mono text-red-500">{deployError}</span>
                      </div>
                    )}
                    <button
                      onClick={handleDeploy}
                      disabled={deploying}
                      className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-mono font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Rocket size={14} />
                      Deploy Now
                    </button>
                    <p className="text-[9px] font-mono text-muted-foreground mt-2 text-center">
                      Free for MontraFi users. External API callers pay $5 USDC via x402.
                    </p>
                  </div>
                )}
              </DashboardCard>
            </div>
          )}

          {/* ── Section 4: Generated Post ── */}
          {hasRequiredFields && (
            <div>
              <SectionHeader icon={Copy} title="Generated Post" />
              <DashboardCard>
                <div className="relative">
                  <pre className="p-3 bg-secondary/50 rounded-xl border border-border text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                    {buildPostContent()}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition flex items-center gap-1.5"
                  >
                    <Copy size={10} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Publish links */}
                <div className="mt-4">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3 block">
                    Publish on a supported platform
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PLATFORMS.map((p) => (
                      <a
                        key={p.name}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 hover:bg-secondary transition"
                      >
                        <div>
                          <span className="text-xs font-mono font-bold text-foreground block">{p.name}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{p.desc}</span>
                        </div>
                        <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground mt-3">
                    Paste the generated post on any platform above. Clawnch scanner detects it within ~1 minute and deploys your token to Base.
                  </p>
                </div>
              </DashboardCard>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pb-8">
            <p className="text-[10px] text-muted-foreground font-mono">
              Powered by Clawnch — Token infrastructure for agents on Base Chain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
