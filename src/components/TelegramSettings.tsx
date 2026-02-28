import { useState, useEffect, useCallback } from 'react';
import { Send, Link2, Unlink, Loader2, CheckCircle, Bell, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface TelegramSettingsProps {
  walletAddress: string;
}

interface LinkStatus {
  linked: boolean;
  telegramUsername?: string;
  alertTypes?: string[];
  linkedAt?: string;
}

const ALERT_TYPE_OPTIONS = [
  { id: 'trade', label: 'Trade Placed', description: 'When agents submit trades' },
  { id: 'trade_filled', label: 'Trade Filled', description: 'When trades are executed' },
  { id: 'ai_insight', label: 'AI Check-ins', description: 'Full AI analysis reports' },
  { id: 'milestone', label: 'Milestones', description: 'P&L milestone crossings' },
  { id: 'burn', label: 'Burns', description: 'MONTRA token burn confirmations' },
  { id: 'status', label: 'Status Updates', description: 'Agent status changes' },
];

const TelegramSettings = ({ walletAddress }: TelegramSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/telegram/link?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await resp.json();
      setLinkStatus(data);
    } catch {
      setLinkStatus({ linked: false });
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleLink = async () => {
    if (!code.trim() || !walletAddress) return;
    setLinking(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, code: code.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setError(data.error || 'Failed to link');
      } else {
        setSuccess('Wallet linked successfully!');
        setCode('');
        await fetchStatus();
      }
    } catch {
      setError('Network error');
    } finally {
      setLinking(false);
    }
  };

  const handleDisconnect = async () => {
    if (!walletAddress) return;
    setDisconnecting(true);
    setError(null);
    try {
      await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, action: 'disconnect' }),
      });
      setLinkStatus({ linked: false });
      setSuccess('Disconnected from Telegram');
    } catch {
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleAlert = async (alertId: string, enabled: boolean) => {
    if (!linkStatus?.alertTypes) return;
    const newTypes = enabled
      ? [...linkStatus.alertTypes, alertId]
      : linkStatus.alertTypes.filter((t) => t !== alertId);

    // Optimistic update
    setLinkStatus({ ...linkStatus, alertTypes: newTypes });

    try {
      await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, alertTypes: newTypes }),
      });
    } catch {
      // Revert on error
      fetchStatus();
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground mb-2" />
        <p className="text-[10px] font-mono text-muted-foreground">Checking Telegram link...</p>
      </div>
    );
  }

  // ── Linked state ───────────────────────────────────────────────────────
  if (linkStatus?.linked) {
    return (
      <div className="space-y-4">
        {/* Connection status */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-xs font-mono font-bold text-foreground">TELEGRAM CONNECTED</span>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">
              {linkStatus.linkedAt
                ? `Linked ${new Date(linkStatus.linkedAt).toLocaleDateString()}`
                : 'Linked'}
            </span>
          </div>
          {linkStatus.telegramUsername && (
            <p className="text-xs font-mono text-primary">@{linkStatus.telegramUsername}</p>
          )}
        </div>

        {/* Alert preferences */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wide">
              Alert Preferences
            </span>
          </div>
          <div className="space-y-3">
            {ALERT_TYPE_OPTIONS.map((opt) => {
              const enabled = linkStatus.alertTypes?.includes(opt.id) ?? true;
              return (
                <div key={opt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-foreground">{opt.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{opt.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => handleToggleAlert(opt.id, checked)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="w-full flex items-center justify-center gap-2 text-xs font-mono font-bold text-destructive border border-destructive/30 rounded-xl px-4 py-2.5 hover:bg-destructive/10 transition disabled:opacity-50"
        >
          {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
          {disconnecting ? 'Disconnecting...' : 'Disconnect Telegram'}
        </button>

        {error && <p className="text-[10px] font-mono text-destructive text-center">{error}</p>}
        {success && <p className="text-[10px] font-mono text-green-400 text-center">{success}</p>}
      </div>
    );
  }

  // ── Not linked state ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send size={16} className="text-primary" />
          <span className="text-sm font-mono font-bold text-foreground">Telegram Alerts</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mb-4 leading-relaxed">
          Receive real-time agent alerts on Telegram — trade fills, AI check-ins,
          P&L milestones, and burn confirmations straight to your phone.
        </p>

        {/* Steps */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary min-w-[16px]">1.</span>
            <span className="text-[10px] font-mono text-foreground">
              Open <a
                href="https://t.me/MontraFinanceBot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                @MontraFinanceBot <ExternalLink size={8} />
              </a> on Telegram
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary min-w-[16px]">2.</span>
            <span className="text-[10px] font-mono text-foreground">Send <code className="bg-secondary px-1 rounded">/connect</code> to get a link code</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary min-w-[16px]">3.</span>
            <span className="text-[10px] font-mono text-foreground">Enter the code below</span>
          </div>
        </div>

        {/* Code input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError(null);
              setSuccess(null);
            }}
            placeholder="ENTER CODE"
            maxLength={6}
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground tracking-widest text-center focus:outline-none focus:border-primary transition"
          />
          <button
            onClick={handleLink}
            disabled={linking || code.length < 6}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-mono font-bold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {linking ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            LINK
          </button>
        </div>

        {error && <p className="text-[10px] font-mono text-destructive mt-2">{error}</p>}
        {success && <p className="text-[10px] font-mono text-green-400 mt-2">{success}</p>}
      </div>
    </div>
  );
};

export default TelegramSettings;
