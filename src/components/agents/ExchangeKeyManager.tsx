import { useState } from 'react';
import { Key, Plus, Trash2, CheckCircle, XCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { testExchangeKeyAPI } from '@/services/exchangeKeyService';
import type { ExchangeName } from '@/types/agent';

interface ExchangeKeyManagerProps {
  open: boolean;
  onClose: () => void;
}

const EXCHANGES: { id: ExchangeName; name: string; icon: string; needsPassphrase: boolean }[] = [
  { id: 'binance', name: 'Binance', icon: '🟡', needsPassphrase: false },
  { id: 'coinbase', name: 'Coinbase', icon: '🔵', needsPassphrase: true },
  { id: 'bybit', name: 'Bybit', icon: '🟠', needsPassphrase: false },
  { id: 'okx', name: 'OKX', icon: '⚫', needsPassphrase: true },
];

type View = 'list' | 'add';

const ExchangeKeyManager = ({ open, onClose }: ExchangeKeyManagerProps) => {
  const { exchangeKeys, exchangeKeysLoading, addExchangeKey, deleteExchangeKey, refreshExchangeKeys } = useAgents();
  const { fullWalletAddress } = useWallet();

  const [view, setView] = useState<View>('list');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add form state
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

  const resetForm = () => {
    setExchange('binance');
    setLabel('');
    setApiKey('');
    setSecret('');
    setPassphrase('');
    setPermissions(['read', 'trade']);
    setError('');
    setSuccess('');
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
      await addExchangeKey(
        exchange,
        label.trim(),
        apiKey.trim(),
        secret.trim(),
        passphrase.trim() || undefined,
        permissions,
      );
      setSuccess('Exchange API key added successfully!');
      setTimeout(() => {
        resetForm();
        setView('list');
      }, 1500);
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
    if (confirmDeleteId !== keyId) {
      setConfirmDeleteId(keyId);
      return;
    }

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
    setPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm],
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      setView('list');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            {view === 'add' && (
              <button onClick={() => { resetForm(); setView('list'); }} className="text-muted-foreground hover:text-foreground transition">
                <ArrowLeft size={14} />
              </button>
            )}
            <Key size={16} className="text-primary" />
            {view === 'list' ? 'Exchange API Keys' : 'Connect Exchange'}
          </DialogTitle>
        </DialogHeader>

        {/* ── List View ── */}
        {view === 'list' && (
          <div className="space-y-3">
            {exchangeKeysLoading ? (
              <div className="py-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground mb-2" />
                <p className="text-[10px] font-mono text-muted-foreground">Loading keys...</p>
              </div>
            ) : exchangeKeys.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <ShieldCheck size={28} className="mx-auto text-muted-foreground/50" />
                <p className="text-xs font-mono text-muted-foreground">No exchange API keys connected</p>
                <p className="text-[10px] font-mono text-muted-foreground/70 max-w-xs mx-auto">
                  Connect your exchange API keys to let agents trade on Binance, Coinbase, Bybit, or OKX.
                  Keys are encrypted with AES-256-GCM.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {exchangeKeys.map(key => {
                  const ex = EXCHANGES.find(e => e.id === key.exchange);
                  const testResult = testResults[key.id];

                  return (
                    <div
                      key={key.id}
                      className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{ex?.icon || '🔑'}</span>
                          <div>
                            <p className="text-xs font-mono font-bold text-foreground">{key.label}</p>
                            <p className="text-[9px] font-mono text-muted-foreground uppercase">{ex?.name || key.exchange}</p>
                          </div>
                        </div>
                        <code className="text-[10px] font-mono text-muted-foreground bg-background/50 rounded px-1.5 py-0.5">
                          {key.apiKeyMasked}
                        </code>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {key.permissions.map(p => (
                          <span key={p} className="text-[8px] font-mono text-muted-foreground bg-background/50 rounded px-1.5 py-0.5 uppercase">
                            {p}
                          </span>
                        ))}
                      </div>

                      {testResult && (
                        <div className={`flex items-center gap-1.5 text-[10px] font-mono ${testResult.valid ? 'text-green-400' : 'text-destructive'}`}>
                          {testResult.valid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {testResult.valid ? 'Connection verified' : testResult.error || 'Connection failed'}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <button
                          onClick={() => handleTest(key.id)}
                          disabled={testingId === key.id}
                          className="text-[10px] font-mono text-muted-foreground hover:text-primary transition disabled:opacity-50"
                        >
                          {testingId === key.id ? 'Testing...' : 'Test Connection'}
                        </button>
                        <span className="text-border">|</span>
                        <button
                          onClick={() => handleDelete(key.id)}
                          disabled={deletingId === key.id}
                          className={`text-[10px] font-mono transition disabled:opacity-50 ${
                            confirmDeleteId === key.id
                              ? 'text-destructive font-bold'
                              : 'text-muted-foreground hover:text-destructive'
                          }`}
                        >
                          {deletingId === key.id
                            ? 'Revoking...'
                            : confirmDeleteId === key.id
                              ? 'Confirm Revoke?'
                              : 'Revoke'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}

            <button
              onClick={() => { setError(''); setView('add'); }}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition"
            >
              <Plus size={14} /> CONNECT EXCHANGE
            </button>
          </div>
        )}

        {/* ── Add View ── */}
        {view === 'add' && (
          <div className="space-y-4">
            {/* Exchange selector */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Exchange</label>
              <div className="grid grid-cols-4 gap-1.5">
                {EXCHANGES.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setExchange(ex.id); setPassphrase(''); }}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-[10px] font-mono transition ${
                      exchange === ex.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="text-lg">{ex.icon}</span>
                    <span>{ex.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Label</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={`My ${selectedExchange?.name || ''} Main`}
                maxLength={64}
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">API Secret</label>
              <input
                type="password"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Enter your API secret"
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
                autoComplete="off"
              />
            </div>

            {/* Passphrase (conditional) */}
            {selectedExchange?.needsPassphrase && (
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Passphrase <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder={`Required for ${selectedExchange.name}`}
                  className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Permissions */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Permissions</label>
              <div className="flex gap-2">
                {['read', 'trade'].map(perm => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border transition ${
                      permissions.includes(perm)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {perm.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Security note */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-green-400">
                <ShieldCheck size={10} className="inline mr-1" />
                Your API credentials are encrypted with AES-256-GCM before storage. Secrets are never stored in plaintext and never returned to the browser.
              </p>
            </div>

            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
            {success && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-400">
                <CheckCircle size={10} /> {success}
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Key size={14} />
              {adding ? 'ENCRYPTING & SAVING...' : 'SAVE API KEY'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExchangeKeyManager;
