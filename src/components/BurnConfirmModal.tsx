/**
 * Burn confirmation modal — shows cost, complexity, balance, and handles confirm/cancel.
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Zap, Flame, AlertTriangle, Loader2 } from "lucide-react";
import type { BurnEstimate, BurnStatus } from "@/types/burn";

const COMPLEXITY_LABELS: Record<string, { label: string; color: string }> = {
  simple: { label: "Simple", color: "text-emerald-600" },
  standard: { label: "Standard", color: "text-blue-600" },
  medium: { label: "Medium", color: "text-amber-600" },
  complex: { label: "Complex", color: "text-orange-600" },
  very_complex: { label: "Very Complex", color: "text-red-600" },
};

const MULTIPLIER_LABELS: Record<string, string> = {
  real_time: "Real-time data",
  historical: "Historical data",
  multiple_markets: "Multi-market",
};

interface Props {
  open: boolean;
  estimate: BurnEstimate | null;
  tokenBalance: number | null;
  burnStatus: BurnStatus;
  burnError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BurnConfirmModal({
  open,
  estimate,
  tokenBalance,
  burnStatus,
  burnError,
  onConfirm,
  onCancel,
}: Props) {
  if (!estimate) return null;

  const cpl = COMPLEXITY_LABELS[estimate.complexity || "standard"] || COMPLEXITY_LABELS.standard;
  const symbol = estimate.tokenSymbol || "MONTRA";
  const amount = estimate.tokenAmount || 0;
  const usdCost = estimate.usdCost;
  const hasBalance = tokenBalance != null && tokenBalance >= amount;
  const isProcessing = burnStatus === "signing" || burnStatus === "confirming";
  const isError = burnStatus === "error";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isProcessing) onCancel(); }}>
      <DialogContent className="bg-white border border-gray-200 rounded-2xl p-0 max-w-md overflow-hidden shadow-lg">
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 border-b border-gray-100"
          style={{ background: "linear-gradient(180deg, rgba(37,99,235,0.04) 0%, transparent 100%)" }}
        >
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Flame size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold text-base tracking-wide">TOKEN BURN REQUIRED</h3>
              <p className="text-gray-400 text-[11px] font-mono mt-0.5">Burn {symbol} to execute query</p>
            </div>
          </DialogTitle>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Amount + USD Cost */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Burn Amount</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-blue-600 font-mono font-bold text-xl">{amount.toLocaleString()}</span>
              <span className="text-blue-600/60 font-mono text-sm">{symbol}</span>
            </div>
          </div>

          {/* USD Cost */}
          {usdCost != null && usdCost > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">USD Cost</span>
              <span className="font-mono text-sm font-semibold text-gray-700">~${usdCost.toFixed(2)}</span>
            </div>
          )}

          {/* Complexity */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Complexity</span>
            <span className={`font-mono text-sm font-semibold ${cpl.color}`}>{cpl.label}</span>
          </div>

          {/* Multipliers */}
          {estimate.multipliers && estimate.multipliers.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Multipliers</span>
              <div className="flex gap-1.5">
                {estimate.multipliers.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-500 text-[10px] font-mono"
                  >
                    {MULTIPLIER_LABELS[m] || m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Balance */}
          {tokenBalance != null && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Your Balance</span>
              <span className={`font-mono text-sm ${hasBalance ? "text-emerald-600" : "text-red-600"}`}>
                {tokenBalance.toLocaleString()} {symbol}
              </span>
            </div>
          )}

          {/* Destination */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Burn To</span>
            <span className="font-mono text-[11px] text-gray-400">0x000...dEaD</span>
          </div>

          {/* Insufficient balance warning */}
          {tokenBalance != null && !hasBalance && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-600 text-xs font-semibold">Insufficient Balance</p>
                <p className="text-red-500/70 text-[11px] mt-0.5">
                  You need {(amount - tokenBalance).toLocaleString()} more {symbol}
                </p>
              </div>
            </div>
          )}

          {/* Processing status */}
          {burnStatus === "signing" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Loader2 size={16} className="text-blue-600 animate-spin" />
              <span className="text-blue-700 text-xs font-mono">Confirm in your wallet...</span>
            </div>
          )}

          {burnStatus === "confirming" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Loader2 size={16} className="text-blue-600 animate-spin" />
              <span className="text-blue-700 text-xs font-mono">Confirming on Base...</span>
            </div>
          )}

          {/* Error */}
          {isError && burnError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-red-600/80 text-xs">{burnError}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium hover:border-gray-300 hover:text-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || (tokenBalance != null && !hasBalance)}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {isProcessing ? "Processing..." : "BURN & QUERY"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
