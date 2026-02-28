import { useState, useCallback, useRef } from 'react';
import { LifeBuoy, Send, CheckCircle, XCircle, Loader2, Paperclip, X } from 'lucide-react';
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setAttachments(prev => [...prev, ...imageFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const filesToBase64 = async (files: File[]): Promise<{ filename: string; content: string; type: string }[]> => {
    return Promise.all(files.map(file => new Promise<{ filename: string; content: string; type: string }>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ filename: file.name, content: base64, type: file.type });
      };
      reader.readAsDataURL(file);
    })));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus('idle');

    try {
      const encodedAttachments = attachments.length > 0 ? await filesToBase64(attachments) : [];
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, attachments: encodedAttachments }),
      });

      if (!res.ok) throw new Error('Failed to send');

      setStatus('success');
      setName('');
      setEmail('');
      setSubject(SUBJECT_OPTIONS[0]);
      setMessage('');
      setAttachments([]);
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  }, [name, email, subject, message, attachments]);

  const hasRequiredFields = name && email && message;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activePage="support" />

      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 md:px-6 py-3">
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

        <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
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

                {/* Attachments */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">
                    Attachments <span className="text-muted-foreground/50">(optional, max 5 images)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= 5}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Paperclip size={14} /> Attach Images
                  </button>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((file, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded-lg border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          >
                            <X size={10} />
                          </button>
                          <span className="block text-[8px] font-mono text-muted-foreground truncate w-16 mt-0.5">
                            {file.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
