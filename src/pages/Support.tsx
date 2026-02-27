import { useState, useCallback } from 'react';
import { LifeBuoy, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';

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

const SUBJECT_OPTIONS = ['Refund', 'Ai Agents', 'Agent Fleet', 'Dashboard', 'API'] as const;

export default function Support() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) throw new Error('Failed to send');

      setStatus('success');
      setName('');
      setEmail('');
      setSubject(SUBJECT_OPTIONS[0]);
      setMessage('');
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  }, [name, email, subject, message]);

  const hasRequiredFields = name && email && message;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activePage="support" />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LifeBuoy size={18} className="text-primary" />
              <span className="text-sm font-bold font-mono">Support</span>
              <span className="text-[10px] text-muted-foreground font-mono">Contact Us</span>
            </div>
            <div className="flex items-center gap-3">
              <TierBadge />
              <ConnectWalletButton />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-2xl mx-auto">
          <div>
            <SectionHeader icon={LifeBuoy} title="Contact Form" />
            <DashboardCard>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
                  >
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    required
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono outline-none focus:border-primary/50 transition resize-none"
                  />
                </div>

                {/* Status Messages */}
                {status === 'success' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle size={14} className="text-green-500" />
                    <span className="text-xs font-mono text-green-500">Message sent successfully! We'll get back to you soon.</span>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle size={14} className="text-red-500" />
                    <span className="text-xs font-mono text-red-500">Failed to send message. Please try again.</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!hasRequiredFields || sending}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-mono font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sending ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={14} /> Submit</>
                  )}
                </button>
              </form>
            </DashboardCard>
          </div>

          {/* Footer */}
          <div className="text-center pb-8">
            <p className="text-[10px] text-muted-foreground font-mono">
              Your message will be sent directly to our support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
