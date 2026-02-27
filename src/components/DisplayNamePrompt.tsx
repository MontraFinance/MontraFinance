import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Loader2 } from "lucide-react";

interface DisplayNamePromptProps {
  open: boolean;
  walletAddress: string;
  onCreated: (displayName: string) => void;
  onClose: () => void;
}

export function DisplayNamePrompt({ open, walletAddress, onCreated, onClose }: DisplayNamePromptProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Client-side basic validation
    if (trimmed.length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    if (trimmed.length > 20) {
      setError("Display name must be 20 characters or less");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_.\-]*$/.test(trimmed)) {
      setError("Must start with a letter. Only letters, numbers, _, -, . allowed");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const resp = await fetch("/api/holders/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, displayName: trimmed }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Failed to save display name");
        return;
      }

      onCreated(data.profile.displayName);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono font-bold">
            <User size={16} className="text-primary" />
            CREATE DISPLAY NAME
          </DialogTitle>
          <DialogDescription className="text-[10px] font-mono text-muted-foreground">
            Choose a display name to use in the Holders Chat. Other members will see this name instead of your wallet address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">
              Display Name
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. CryptoKing"
              maxLength={20}
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">
              2-20 characters. Letters, numbers, underscores, hyphens, periods. Must start with a letter.
            </p>
          </div>

          {error && (
            <p className="text-[10px] font-mono text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="w-full font-mono text-xs font-bold"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                SAVING...
              </>
            ) : (
              "SET DISPLAY NAME"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
