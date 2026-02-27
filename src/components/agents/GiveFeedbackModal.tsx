import { useState } from 'react';
import { Star, Send, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWallet } from '@/contexts/WalletContext';
import { giveFeedback } from '@/lib/erc8004';

interface Props {
  open: boolean;
  onClose: () => void;
  agentName: string;
  erc8004AgentId: number;
}

const GiveFeedbackModal = ({ open, onClose, agentName, erc8004AgentId }: Props) => {
  const { getProvider, connected } = useWallet();
  const [score, setScore] = useState(80);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const provider = getProvider();
    if (!provider) {
      setError('Wallet not connected');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await giveFeedback(provider, erc8004AgentId, score, 0, 'quality', '');
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setScore(80);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setError('');
      setSubmitted(false);
      setScore(80);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Star size={16} className="text-yellow-500" />
            Rate Agent: {agentName}
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <CheckCircle size={32} className="text-primary mx-auto mb-3" />
            <p className="text-sm font-mono text-primary font-bold">Feedback Submitted</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Your on-chain review has been recorded on the ERC-8004 Reputation Registry
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-3">
                Quality Score
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(parseInt(e.target.value))}
                  className="flex-1 accent-yellow-500 h-1.5"
                />
                <span className="text-sm font-mono font-bold text-foreground w-12 text-right">
                  {score}/100
                </span>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50 mt-1">
                <span>Poor</span>
                <span>Average</span>
                <span>Excellent</span>
              </div>
            </div>

            <p className="text-[10px] font-mono text-muted-foreground">
              This submits an on-chain transaction to the ERC-8004 Reputation Registry on Base. You will pay a small gas fee.
            </p>

            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !connected}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-black text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} /> {submitting ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GiveFeedbackModal;
