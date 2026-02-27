import { X, Copy, Check, Sun, Moon, Key, Plus, CheckCircle, XCircle, Loader2, ShieldCheck, User, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useAgents } from '@/contexts/AgentContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { testExchangeKeyAPI } from '@/services/exchangeKeyService';
import type { ExchangeName } from '@/types/agent';

const EXCHANGES: { id: ExchangeName; name: string; icon: string; needsPassphrase: boolean }[] = [
  { id: 'binance', name: 'Binance', icon: '\u{1F7E1}', needsPassphrase: false },
  { id: 'coinbase', name: 'Coinbase', icon: '\u{1F535}', needsPassphrase: false },
  { id: 'bybit', name: 'Bybit', icon: '\u{1F7E0}', needsPassphrase: false },
  { id: 'okx', name: 'OKX', icon: '\u26AB', needsPassphrase: true },
  { id: 'bitunix', name: 'Bitunix', icon: '\u{1F7E2}', needsPassphrase: false },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { connected, fullWalletAddress, walletType } = useWallet();
  const { exchangeKeys, exchangeKeysLoading, addExchangeKey, deleteExchangeKey } = useAgents();
  const { theme, toggleTheme } = useTheme();

  // Copy address
  const [copied, setCopied] = useState(false);

  // Display name state
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameEditing, setDisplayNameEditing] = useState(false);
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [displayNameSuccess, setDisplayNameSuccess] = useState('');

  // Exchange key form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exchange, setExchange] = useState<ExchangeName>('binance');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read', 'trade']);
  const [adding, setAdding] = useState(false);

  // Test/delete state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedExchange = EXCHANGES.find(e => e.id === exchange);

  // Reset transient UI state when modal closes
  useEffect(() => {
    if (!open) {
      setDisplayNameEditing(false);
      setDisplayNameError('');
      setDisplayNameSuccess('');
      setShowAddForm(false);
      setError('');
      setSuccess('');
      setExchange('binance');
      setLabel('');
      setApiKey('');
      setSecret('');
      setPassphrase('');
      setPermissions(['read', 'trade']);
      setConfirmDeleteId(null);
      setTestResults({});
    }
  }, [open]);

  // Fetch display name when modal opens
  useEffect(() => {
    if (!open || !connected || !fullWalletAddress) return;
    setDisplayNameLoading(true);
    fetch(`/api/holders/profile?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((data) => {
        const name = data.profile?.displayName || null;
        setCurrentDisplayName(name);
        setNewDisplayName(name || '');
      })
      .catch(() => {})
      .finally(() => setDisplayNameLoading(false));
  }, [open, connected, fullWalletAddress]);

  if (!open) return null;

  const handleCopy = () => {
    if (fullWalletAddress) {
      navigator.clipboard.writeText(fullWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Display name handlers
  const handleDisplayNameSave = async () => {
    const trimmed = newDisplayName.trim();
    if (!trimmed || !fullWalletAddress) return;
    setDisplayNameError('');
    setDisplayNameSuccess('');
    setDisplayNameSaving(true);
    try {
      const resp = await fetch('/api/holders/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: fullWalletAddress, displayName: trimmed }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setDisplayNameError(data.error || 'Failed to update display name');
        return;
      }
      setCurrentDisplayName(data.profile.displayName);
      setNewDisplayName(data.profile.displayName);
      setDisplayNameSuccess('Display name updated!');
      setDisplayNameEditing(false);
      setTimeout(() => setDisplayNameSuccess(''), 3000);
    } catch {
      setDisplayNameError('Network error — please try again');
    } finally {
      setDisplayNameSaving(false);
    }
  };

  // Exchange key handlers
  const resetForm = () => {
    setExchange('binance');
    setLabel('');
    setApiKey('');
    setSecret('');
    setPassphrase('');
    setPermissions(['read', 'trade']);
    setError('');
    setSuccess('');
    setShowAddForm(false);
  };

  const handleAdd = async () => {
    setError('');
    setSuccess('');
    if (!label.trim()) { setError('Label is required'); return; }
    if (!apiKey.trim() || apiKey.length < 8) { setError('API Key is required (min 8 chars)'); return; }
    if (!secret.trim() || secret.length < 8) { setError('API Secret is required (min 8 chars)'); return; }
    if (selectedExchange?.needsPassphrase && !passphrase.trim()) {
      setError(`Passphrase is required for ${selectedExchange.name}`);
      return;
    }
    setAdding(true);
    try {
      await addExchangeKey(exchange, label.trim(), apiKey.trim(), secret.trim(), passphrase.trim() || undefined, permissions);
      setSuccess('Exchange API key added successfully!');
      setTimeout(resetForm, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to add exchange key');
    } finally {
      setAdding(false);
    }
  };

  const handleTest = async (keyId: string) => {
    if (!fullWalletAddress) return;
    setTestingId(keyId);
    try {
      const result = await testExchangeKeyAPI(fullWalletAddress, keyId);
      setTestResults(prev => ({ ...prev, [keyId]: result }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [keyId]: { valid: false, error: err.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (confirmDeleteId !== keyId) { setConfirmDeleteId(keyId); return; }
    setDeletingId(keyId);
    setError('');
    try {
      await deleteExchangeKey(keyId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke key');
    } finally {
      setDeletingId(null);
    }
  };

  const togglePermission = (perm: string) => {
    setPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* ── Public Key ── */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-2">
              Public Key {walletType && `(${walletType})`}
            </p>
            <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-foreground break-all flex-1">
                {fullWalletAddress || 'Not connected'}
              </p>
              {fullWalletAddress && (
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-1.5 rounded-md hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* ── Accessibility ── */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-3">
              Accessibility
            </p>
            <div className="flex items-center justify-between bg-secondary/50 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                {theme === 'light' ? (
                  <Sun size={14} className="text-muted-foreground" />
                ) : (
                  <Moon size={14} className="text-muted-foreground" />
                )}
                <span className="text-xs font-mono text-foreground">
                  {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>

          {/* ── Display Name ── */}
          {connected && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-3">
                Display Name
              </p>

              {displayNameLoading ? (
                <div className="py-3 text-center">
                  <Loader2 size={14} className="animate-spin mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] font-mono text-muted-foreground">Loading...</p>
                </div>
              ) : !displayNameEditing ? (
                <div className="flex items-center justify-between bg-secondary/50 border border-border rounded-lg p-3">
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase mb-0.5">Holders Chat Name</p>
                    {currentDisplayName ? (
                      <p className="text-xs font-mono font-bold text-foreground">{currentDisplayName}</p>
                    ) : (
                      <p className="text-xs font-mono text-muted-foreground/50 italic">Not set</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setDisplayNameEditing(true);
                      setDisplayNameError('');
                      setDisplayNameSuccess('');
                      setNewDisplayName(currentDisplayName || '');
                    }}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition"
                  >
                    <Pencil size={10} />
                    {currentDisplayName ? 'Change' : 'Set'}
                  </button>
                </div>
              ) : (
                <div className="bg-secondary/50 border border-primary/30 rounded-lg p-3 space-y-2">
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => { setNewDisplayName(e.target.value); setDisplayNameError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDisplayNameSave()}
                    placeholder="e.g. CryptoKing"
                    maxLength={20}
                    className="w-full bg-transparent text-xs font-mono text-foreground outline-none border-b border-border focus:border-primary py-1 placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  <p className="text-[8px] font-mono text-muted-foreground/60">
                    2-20 chars. Letters, numbers, _, -, . — must start with a letter.
                  </p>
                  {displayNameError && (
                    <p className="text-[10px] font-mono text-destructive">{displayNameError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDisplayNameEditing(false);
                        setDisplayNameError('');
                        setNewDisplayName(currentDisplayName || '');
                      }}
                      className="flex-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2 py-1.5 hover:bg-secondary transition"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleDisplayNameSave}
                      disabled={displayNameSaving || !newDisplayName.trim()}
                      className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 hover:bg-primary/80 transition disabled:opacity-50"
                    >
                      {displayNameSaving ? <Loader2 size={10} className="animate-spin" /> : <User size={10} />}
                      {displayNameSaving ? 'SAVING...' : 'SAVE'}
                    </button>
                  </div>
                </div>
              )}

              {displayNameSuccess && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-400 mt-1.5">
                  <CheckCircle size={10} /> {displayNameSuccess}
                </div>
              )}
            </div>
          )}

          {/* ── Exchange API Keys ── */}
          {connected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                  Exchange API Keys
                </p>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {/* Security note */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2.5 mb-3">
                <p className="text-[9px] font-mono text-green-400">
                  <ShieldCheck size={9} className="inline mr-1" />
                  Credentials encrypted with AES-256-GCM. Secrets never stored in plaintext.
                </p>
              </div>

              {/* Add Form */}
              {showAddForm && (
                <div className="bg-secondary/50 border border-primary/30 rounded-lg p-3 mb-3 space-y-3">
                  <p className="text-[10px] font-mono font-bold text-foreground">Connect New Exchange</p>

                  {/* Exchange selector */}
                  <div className="grid grid-cols-5 gap-1">
                    {EXCHANGES.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => { setExchange(ex.id); setPassphrase(''); }}
                        className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-[9px] font-mono transition ${
                          exchange === ex.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        <span className="text-sm">{ex.icon}</span>
                        <span>{ex.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Label */}
                  <div>
                    <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Label</label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder={`My ${selectedExchange?.name || ''} Main`}
                      maxLength={64}
                      className="w-full bg-transparent text-xs font-mono text-foreground outline-none border-b border-border focus:border-primary py-1 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">API Key</label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="w-full bg-transparent text-xs font-mono text-foreground outline-none border-b border-border focus:border-primary py-1 placeholder:text-muted-foreground/50"
                      autoComplete="off"
                    />
                  </div>

                  {/* API Secret */}
                  <div>
                    <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">API Secret</label>
                    <input
                      type="password"
                      value={secret}
                      onChange={e => setSecret(e.target.value)}
                      placeholder="Enter your API secret"
                      className="w-full bg-transparent text-xs font-mono text-foreground outline-none border-b border-border focus:border-primary py-1 placeholder:text-muted-foreground/50"
                      autoComplete="off"
                    />
                  </div>

                  {/* Passphrase (conditional) */}
                  {selectedExchange?.needsPassphrase && (
                    <div>
                      <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">
                        Passphrase <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="password"
                        value={passphrase}
                        onChange={e => setPassphrase(e.target.value)}
                        placeholder={`Required for ${selectedExchange.name}`}
                        className="w-full bg-transparent text-xs font-mono text-foreground outline-none border-b border-border focus:border-primary py-1 placeholder:text-muted-foreground/50"
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {/* Permissions */}
                  <div className="flex gap-1.5">
                    {['read', 'trade'].map(perm => (
                      <button
                        key={perm}
                        onClick={() => togglePermission(perm)}
                        className={`text-[9px] font-mono px-2.5 py-1 rounded-lg border transition ${
                          permissions.includes(perm)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {perm.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
                  {success && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-400">
                      <CheckCircle size={10} /> {success}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={resetForm}
                      className="flex-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2 py-1.5 hover:bg-secondary transition"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold rounded-lg px-2 py-1.5 hover:bg-primary/80 transition disabled:opacity-50"
                    >
                      <Key size={10} />
                      {adding ? 'ENCRYPTING...' : 'SAVE KEY'}
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Keys */}
              {exchangeKeysLoading ? (
                <div className="py-4 text-center">
                  <Loader2 size={14} className="animate-spin mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] font-mono text-muted-foreground">Loading keys...</p>
                </div>
              ) : exchangeKeys.length === 0 && !showAddForm ? (
                <div className="bg-secondary/50 border border-border rounded-lg p-4 text-center">
                  <Key size={20} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[10px] font-mono text-muted-foreground">No exchange API keys connected</p>
                </div>
              ) : exchangeKeys.length > 0 ? (
                <div className="space-y-2">
                  {exchangeKeys.map(key => {
                    const ex = EXCHANGES.find(e => e.id === key.exchange);
                    const testResult = testResults[key.id];

                    return (
                      <div key={key.id} className="bg-secondary/50 border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{ex?.icon || '\u{1F511}'}</span>
                            <div>
                              <p className="text-[10px] font-mono font-bold text-foreground">{key.label}</p>
                              <p className="text-[8px] font-mono text-muted-foreground uppercase">{ex?.name || key.exchange}</p>
                            </div>
                          </div>
                          <code className="text-[9px] font-mono text-muted-foreground bg-background/50 rounded px-1 py-0.5">
                            {key.apiKeyMasked}
                          </code>
                        </div>

                        <div className="flex items-center gap-1">
                          {key.permissions.map((p: string) => (
                            <span key={p} className="text-[7px] font-mono text-muted-foreground bg-background/50 rounded px-1 py-0.5 uppercase">
                              {p}
                            </span>
                          ))}
                        </div>

                        {testResult && (
                          <div className={`flex items-center gap-1 text-[9px] font-mono ${testResult.valid ? 'text-green-400' : 'text-destructive'}`}>
                            {testResult.valid ? <CheckCircle size={9} /> : <XCircle size={9} />}
                            {testResult.valid ? 'Verified' : testResult.error || 'Failed'}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                          <button
                            onClick={() => handleTest(key.id)}
                            disabled={testingId === key.id}
                            className="text-[9px] font-mono text-muted-foreground hover:text-primary transition disabled:opacity-50"
                          >
                            {testingId === key.id ? 'Testing...' : 'Test'}
                          </button>
                          <span className="text-border text-[9px]">|</span>
                          <button
                            onClick={() => handleDelete(key.id)}
                            disabled={deletingId === key.id}
                            className={`text-[9px] font-mono transition disabled:opacity-50 ${
                              confirmDeleteId === key.id
                                ? 'text-destructive font-bold'
                                : 'text-muted-foreground hover:text-destructive'
                            }`}
                          >
                            {deletingId === key.id
                              ? 'Revoking...'
                              : confirmDeleteId === key.id
                                ? 'Confirm?'
                                : 'Revoke'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
