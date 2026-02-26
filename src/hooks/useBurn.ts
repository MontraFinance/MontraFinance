/**
 * Hook that orchestrates the full burn-to-query flow.
 * Returns requestBurn(query) which resolves to true (proceed) or false (cancelled/failed).
 */
import { useState, useRef, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import type { BurnEstimate, BurnStatus } from "@/types/burn";
import {
  isBurnEnabled,
  estimateBurn,
  submitBurn,
  processBurn,
  executeBurnTransaction,
  checkTokenBalance,
} from "@/services/burnService";

export function useBurn() {
  const { connected, fullWalletAddress, getProvider, setShowModal } = useWallet();

  const [estimate, setEstimate] = useState<BurnEstimate | null>(null);
  const [burnStatus, setBurnStatus] = useState<BurnStatus>("idle");
  const [burnError, setBurnError] = useState<string | null>(null);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  // Promise resolver for the confirmation modal
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmBurn = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const cancelBurn = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setShowBurnModal(false);
    setBurnStatus("idle");
    setEstimate(null);
    setBurnError(null);
  }, []);

  const requestBurn = useCallback(
    async (query: string): Promise<boolean> => {
      // Passthrough if burn disabled
      if (!isBurnEnabled()) return true;

      // Must be connected
      if (!connected || !fullWalletAddress) {
        setShowModal(true);
        return false;
      }

      const provider = getProvider();
      if (!provider) {
        setBurnError("Wallet provider not available");
        return false;
      }

      try {
        // Phase 1: Estimate
        setBurnStatus("estimating");
        setBurnError(null);
        const est = await estimateBurn(query);

        if (!est.burnRequired) {
          setBurnStatus("idle");
          return true;
        }

        setEstimate(est);

        // Check balance
        if (est.tokenAddress && est.tokenDecimals != null) {
          try {
            const bal = await checkTokenBalance(
              provider,
              est.tokenAddress,
              fullWalletAddress,
              est.tokenDecimals
            );
            setTokenBalance(bal);
          } catch {
            setTokenBalance(null);
          }
        }

        // Phase 2: Show modal and wait for user confirmation
        setBurnStatus("awaiting_confirmation");
        setShowBurnModal(true);

        const confirmed = await new Promise<boolean>((resolve) => {
          resolveRef.current = resolve;
        });

        if (!confirmed) return false;

        // Phase 3: Submit to create pending record
        setBurnStatus("signing");
        const submission = await submitBurn(
          fullWalletAddress,
          query,
          est.tokenAmount!,
          est.complexity!
        );

        if (!submission.burnId) {
          throw new Error("Failed to create burn record");
        }

        // Phase 4: Execute the burn transaction via wallet
        const txHash = await executeBurnTransaction(
          provider,
          est.tokenAddress!,
          est.deadAddress!,
          est.tokenAmount!,
          est.tokenDecimals!
        );

        // Phase 5: Verify on-chain
        setBurnStatus("confirming");
        const verification = await processBurn(submission.burnId, txHash);

        if (!verification.verified) {
          throw new Error(verification.error || "Burn verification failed");
        }

        setBurnStatus("verified");
        setShowBurnModal(false);
        setEstimate(null);

        // Brief delay for UX
        await new Promise((r) => setTimeout(r, 300));
        setBurnStatus("idle");

        return true;
      } catch (err: any) {
        const msg = err?.message || "Burn failed";
        // User rejected in wallet
        if (err?.code === 4001 || msg.includes("rejected") || msg.includes("denied")) {
          cancelBurn();
          return false;
        }
        setBurnStatus("error");
        setBurnError(msg);
        return false;
      }
    },
    [connected, fullWalletAddress, getProvider, setShowModal, cancelBurn]
  );

  return {
    requestBurn,
    estimate,
    burnStatus,
    burnError,
    showBurnModal,
    tokenBalance,
    confirmBurn,
    cancelBurn,
  };
}
