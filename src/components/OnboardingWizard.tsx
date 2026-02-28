import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import type { ProfileModel, Stage, Intent, LaunchPlatform, Category, LaunchType } from "@/types/project";

const STEPS = [
  { key: "token", label: "Token" },
  { key: "stage", label: "Stage" },
  { key: "context", label: "Context" },
  { key: "intent", label: "Intent" },
  { key: "snapshot", label: "Summary" },
] as const;

// ── Choice Card ──

function ChoiceCard({ title, description, selected, onClick }: {
  title: string; description: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full rounded-xl border p-3.5 transition text-left ${
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-background hover:border-primary/20 hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{description}</p>
        </div>
        <div className={`w-4 h-4 rounded-full border-2 transition flex-shrink-0 ${
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        }`} />
      </div>
    </button>
  );
}

// ── Select Modal ──

function SelectModal({ label, value, onChange, options, placeholder = "Select\u2026" }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; hint?: string }>; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-xs text-foreground transition hover:bg-secondary/30 flex items-center justify-between"
      >
        <span>{value ? options.find((o) => o.value === value)?.label || placeholder : placeholder}</span>
        <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-xs font-bold text-foreground">{label}</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full px-4 py-3 text-left text-xs transition border-b border-border last:border-b-0 ${
                    opt.value === value ? "bg-primary/10 text-primary font-bold" : "hover:bg-secondary/30 text-foreground"
                  }`}
                >
                  <p className="font-medium">{opt.label}</p>
                  {opt.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{opt.hint}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Label helpers ──

const StageLabel = (s: Stage) => s === "pre-launch" ? "Pre-launch" : s === "live" ? "Live (0\u201372h)" : s === "post-launch" ? "Post-launch" : "Revival / Declining";
const IntentLabel = (i: Intent) => i === "fast-flip" ? "Fast flip" : i === "medium" ? "Medium-term growth" : "Long-term ecosystem";
const PlatformLabel = (p: LaunchPlatform) => ({ uniswap: "Uniswap", aerodrome: "Aerodrome", baseswap: "BaseSwap", clawn: "Clawn", clanker: "Clanker", bankr: "Bankr" }[p]);
const CategoryLabel = (c: Category) => ({ ai: "AI", meme: "Meme", defi: "DeFi", gamify: "Gamify", nft: "NFT", socialfi: "SocialFi", dao: "DAO", utility: "Utility" }[c]);
const LaunchTypeLabel = (t: LaunchType) => t === "meme" ? "Meme" : t === "liquidity" ? "Liquidity" : "IDO";

// ── Main ──

interface OnboardingWizardProps {
  onComplete: (model: ProfileModel) => void;
  onWalletCheckNeeded?: () => boolean;
}

export default function OnboardingWizard({ onComplete, onWalletCheckNeeded }: OnboardingWizardProps) {
  const [model, setModel] = useState<ProfileModel>({
    tokenAddress: "", isPrelaunch: false, stage: null, launchPlatform: null,
    launchType: null, category: null, intent: null, devWallet: "", marketingWallet: "",
  });
  const [stepIdx, setStepIdx] = useState(0);

  const actualSteps = useMemo(() => model.isPrelaunch
    ? [{ key: "token", label: "Token" }, { key: "context", label: "Context" }, { key: "intent", label: "Intent" }, { key: "snapshot", label: "Summary" }] as const
    : STEPS
  , [model.isPrelaunch]);

  const canContinue = useMemo(() => {
    const step = actualSteps[stepIdx]?.key;
    if (step === "token") return model.isPrelaunch || /^0x[a-fA-F0-9]{40}$/.test(model.tokenAddress);
    if (step === "stage") return model.stage !== null;
    if (step === "context") return model.launchPlatform !== null && model.launchType !== null && model.category !== null;
    if (step === "intent") return model.intent !== null;
    return true;
  }, [model, stepIdx, actualSteps]);

  const goNext = () => setStepIdx((i) => Math.min(i + 1, actualSteps.length - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));
  const handleComplete = () => {
    if (onWalletCheckNeeded && !onWalletCheckNeeded()) return;
    onComplete(model);
  };

  const renderStep = () => {
    const step = actualSteps[stepIdx]?.key;

    if (step === "token") return (
      <div className="space-y-3">
        <ChoiceCard title="I have a token address" description="Analyze an existing or pre-deployed token" selected={!model.isPrelaunch}
          onClick={() => setModel((m) => ({ ...m, isPrelaunch: false, tokenAddress: "" }))} />
        <ChoiceCard title="I'm pre-launching" description="Haven't deployed yet; I need onboarding guidance" selected={model.isPrelaunch}
          onClick={() => setModel((m) => ({ ...m, isPrelaunch: true }))} />
        {!model.isPrelaunch && (
          <div className="mt-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Token Address (Base)</span>
            <input type="text" placeholder="0x..." value={model.tokenAddress}
              onChange={(e) => setModel((m) => ({ ...m, tokenAddress: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        )}
      </div>
    );

    if (step === "stage") return (
      <div className="space-y-2">
        {(["pre-launch", "live", "post-launch", "revival"] as Stage[]).map((s) => (
          <ChoiceCard key={s} title={StageLabel(s)} selected={model.stage === s} onClick={() => setModel((m) => ({ ...m, stage: s }))}
            description={s === "pre-launch" ? "Not yet listed on DEX" : s === "live" ? "Just launched or trading actively" : s === "post-launch" ? "Established presence" : "Was active, now dormant"} />
        ))}
      </div>
    );

    if (step === "context") return (
      <div className="space-y-3">
        <SelectModal label="Launch Platform" value={model.launchPlatform || ""}
          onChange={(v) => setModel((m) => ({ ...m, launchPlatform: v as LaunchPlatform }))}
          options={[
            { value: "uniswap", label: "Uniswap", hint: "Uniswap V3 on Base" },
            { value: "aerodrome", label: "Aerodrome", hint: "Aerodrome Finance DEX" },
            { value: "baseswap", label: "BaseSwap", hint: "BaseSwap DEX" },
            { value: "clawn", label: "Clawn", hint: "Clawn launchpad" },
            { value: "clanker", label: "Clanker", hint: "Clanker token deployer" },
            { value: "bankr", label: "Bankr", hint: "Bankr launchpad" },
          ]} />
        <SelectModal label="Launch Type" value={model.launchType || ""}
          onChange={(v) => setModel((m) => ({ ...m, launchType: v as LaunchType }))}
          options={[
            { value: "meme", label: "Meme", hint: "Meme-style (emphasis on culture)" },
            { value: "liquidity", label: "Liquidity", hint: "Liquidity launch with LP" },
            { value: "ido", label: "IDO", hint: "IDO or presale-backed launch" },
          ]} />
        <SelectModal label="Category" value={model.category || ""}
          onChange={(v) => setModel((m) => ({ ...m, category: v as Category }))}
          options={[
            { value: "ai", label: "AI", hint: "AI / ML related" }, { value: "meme", label: "Meme", hint: "Meme / culture-driven" },
            { value: "defi", label: "DeFi", hint: "DeFi protocol" }, { value: "gamify", label: "Gamify", hint: "Gamification" },
            { value: "nft", label: "NFT", hint: "NFT ecosystem" }, { value: "socialfi", label: "SocialFi", hint: "Social Finance" },
            { value: "dao", label: "DAO", hint: "DAO / Governance" }, { value: "utility", label: "Utility", hint: "Utility / Other" },
          ]} />
      </div>
    );

    if (step === "intent") return (
      <div className="space-y-2">
        {(["fast-flip", "medium", "long"] as Intent[]).map((i) => (
          <ChoiceCard key={i} title={IntentLabel(i)} selected={model.intent === i} onClick={() => setModel((m) => ({ ...m, intent: i }))}
            description={i === "fast-flip" ? "Quick profit + exit within hours/days" : i === "medium" ? "1\u201312 week timeframe" : "Belief in long-term utility"} />
        ))}
      </div>
    );

    if (step === "snapshot") return (
      <div className="space-y-2">
        <div className="bg-background rounded-lg border border-border p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Token</span>
          <span className="text-xs font-bold font-mono text-foreground break-all">{model.isPrelaunch ? "Pre-launch" : model.tokenAddress}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Stage", value: model.stage ? StageLabel(model.stage) : "\u2014" },
            { label: "Intent", value: model.intent ? IntentLabel(model.intent) : "\u2014" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-background rounded-lg border border-border p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">{label}</span>
              <span className="text-xs font-bold text-foreground">{value}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Platform", value: model.launchPlatform ? PlatformLabel(model.launchPlatform) : "\u2014" },
            { label: "Type", value: model.launchType ? LaunchTypeLabel(model.launchType) : "\u2014" },
            { label: "Category", value: model.category ? CategoryLabel(model.category) : "\u2014" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-background rounded-lg border border-border p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">{label}</span>
              <span className="text-[10px] font-bold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );

    return null;
  };

  const stepTitle = () => {
    const step = actualSteps[stepIdx]?.key;
    if (step === "token") return "Let's start with your token";
    if (step === "stage") return "What stage is the token at?";
    if (step === "context") return "Token context";
    if (step === "intent") return "What's your intent?";
    return "Project summary";
  };

  return (
    <div className="font-mono">
      {/* Progress */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project Setup</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {stepIdx + 1}/{actualSteps.length}
        </span>
      </div>

      {/* Step progress dots */}
      <div className="flex gap-1 mb-5">
        {actualSteps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= stepIdx ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      {/* Title */}
      <h2 className="text-sm font-bold text-foreground mb-1">{stepTitle()}</h2>
      <p className="text-[10px] text-muted-foreground mb-4">
        {actualSteps[stepIdx]?.key === "snapshot" ? "Review and create your project" : "This helps us tailor the analysis"}
      </p>

      {renderStep()}

      {/* Navigation */}
      <div className="mt-6 flex items-center gap-2">
        {stepIdx > 0 && (
          <button onClick={goBack} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition">
            <ArrowLeft size={12} /> Back
          </button>
        )}
        {stepIdx < actualSteps.length - 1 ? (
          <button onClick={goNext} disabled={!canContinue}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            Next <ArrowRight size={12} />
          </button>
        ) : (
          <button onClick={handleComplete} disabled={!canContinue}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            Create Project <Sparkles size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
