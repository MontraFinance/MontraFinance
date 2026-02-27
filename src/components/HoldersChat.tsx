import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Lock, Users, Loader2, AtSign } from "lucide-react";
import type { TierId } from "@/types/tier";
import { getTierDef } from "@/types/tier";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";

interface HolderMessage {
  id: string;
  wallet_address: string;
  display_name: string | null;
  content: string;
  tier: string;
  created_at: string;
}

interface HoldersChatProps {
  walletAddress: string;
  tier: TierId;
  balance: number;
  tierLoading: boolean;
  displayName: string | null;
  onDisplayNameCreated: (name: string) => void;
  onDisplayNameDismissed: () => void;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function TierTag({ tier }: { tier: string }) {
  const def = getTierDef(tier as TierId);
  if (tier === "none") return null;
  return (
    <span className={`text-[9px] font-mono font-bold ${def.color}`}>
      {def.icon} {def.label}
    </span>
  );
}

/** Render message content with @mentions highlighted */
function MessageContent({ content, className }: { content: string; className?: string }) {
  const parts = content.split(/(@[a-zA-Z][a-zA-Z0-9_.\-]{1,19})/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="text-cyan-400 font-bold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function HoldersChat({
  walletAddress,
  tier,
  balance,
  tierLoading,
  displayName,
  onDisplayNameCreated,
  onDisplayNameDismissed,
}: HoldersChatProps) {
  const isHolder = balance > 0;
  const [messages, setMessages] = useState<HolderMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOptions, setMentionOptions] = useState<string[]>([]);

  const isOwnMessage = useCallback(
    (addr: string) => addr.toLowerCase() === walletAddress.toLowerCase(),
    [walletAddress],
  );

  // Build list of known display names from messages
  const knownNames = useCallback(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.display_name && !isOwnMessage(msg.wallet_address)) {
        names.add(msg.display_name);
      }
    }
    return [...names].sort();
  }, [messages, isOwnMessage]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const resp = await fetch("/api/holders/messages?limit=50");
      if (resp.ok) {
        const json = await resp.json();
        const newMsgs: HolderMessage[] = json.messages || [];
        setMessages((prev) => {
          if (
            prev.length === newMsgs.length &&
            prev[prev.length - 1]?.id === newMsgs[newMsgs.length - 1]?.id
          ) {
            return prev;
          }
          return newMsgs;
        });
      }
    } catch {
      // non-critical
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isHolder) return;
    fetchMessages().finally(() => setLoading(false));
  }, [isHolder, fetchMessages]);

  // Polling every 4 seconds
  useEffect(() => {
    if (!isHolder) return;
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [isHolder, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle input change for @mention autocomplete
  const handleInputChange = (value: string) => {
    setInput(value);
    setSendError("");

    // Check for @mention trigger
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.\-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      const names = knownNames();
      const filtered = query
        ? names.filter((n) => n.toLowerCase().startsWith(query))
        : names;
      setMentionOptions(filtered.slice(0, 5));
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention
  const insertMention = (name: string) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.\-]*)$/);

    if (mentionMatch) {
      const start = cursorPos - mentionMatch[0].length;
      const newValue = input.slice(0, start) + `@${name} ` + input.slice(cursorPos);
      setInput(newValue);
    }

    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userText = input.trim();
    setInput("");
    setSending(true);
    setSendError("");
    setShowMentions(false);

    // Optimistic: add message immediately
    const tempMsg: HolderMessage = {
      id: `temp-${Date.now()}`,
      wallet_address: walletAddress.toLowerCase(),
      display_name: displayName,
      content: userText,
      tier,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const resp = await fetch("/api/holders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, message: userText }),
      });

      if (resp.status === 403) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            wallet_address: "system",
            display_name: null,
            content: "Your holder status has changed. You must hold $MONTRA tokens to chat.",
            tier: "none",
            created_at: new Date().toISOString(),
          },
        ]);
      } else if (!resp.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        const data = await resp.json().catch(() => null);
        setSendError(data?.error || "Failed to send message");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setSendError("Network error");
    } finally {
      setSending(false);
    }
  };

  // ── Loading state ──
  if (tierLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] bg-background border border-border rounded-lg items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground mb-3" />
        <p className="text-xs font-mono text-muted-foreground">Checking holder status...</p>
      </div>
    );
  }

  // ── Locked state ──
  if (!isHolder) {
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] bg-background border border-border rounded-lg items-center justify-center">
        <Lock size={32} className="text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-mono font-bold text-foreground mb-2">HOLDERS ONLY</h3>
        <p className="text-[10px] font-mono text-muted-foreground text-center max-w-xs mb-1">
          This group chat is exclusive to $MONTRA token holders.
        </p>
        <p className="text-[10px] font-mono text-muted-foreground/70 text-center max-w-xs">
          Hold any amount of $MONTRA to unlock access.
        </p>
      </div>
    );
  }

  // ── Display name prompt ──
  const needsDisplayName = !displayName;

  // ── Chat state ──
  return (
    <>
      <DisplayNamePrompt
        open={needsDisplayName}
        walletAddress={walletAddress}
        onCreated={onDisplayNameCreated}
        onClose={onDisplayNameDismissed}
      />

      <div className="flex flex-col h-[calc(100vh-200px)] bg-background border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium">Holders Chat</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-8">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Users size={28} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs font-mono text-muted-foreground mb-1">No messages yet</p>
              <p className="text-[10px] font-mono text-muted-foreground/70">
                Start the conversation with fellow holders.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => {
                const own = msg.wallet_address !== "system" && isOwnMessage(msg.wallet_address);
                const isSystem = msg.wallet_address === "system";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center py-1">
                      <span className="text-[10px] font-mono text-destructive">{msg.content}</span>
                    </div>
                  );
                }

                const senderLabel = msg.display_name || truncateAddress(msg.wallet_address);

                return (
                  <div key={msg.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${own ? "text-right" : "text-left"}`}>
                      {/* Sender info */}
                      <div
                        className={`flex items-center gap-1.5 mb-0.5 ${own ? "justify-end" : "justify-start"}`}
                      >
                        <span className="text-[9px] font-mono text-muted-foreground font-medium">
                          {senderLabel}
                        </span>
                        <TierTag tier={msg.tier} />
                        {own && (
                          <span className="text-[8px] font-mono font-bold text-primary bg-primary/10 rounded px-1">
                            YOU
                          </span>
                        )}
                      </div>
                      {/* Message bubble */}
                      <div
                        className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap inline-block ${
                          own
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <MessageContent content={msg.content} />
                      </div>
                      {/* Timestamp */}
                      <p
                        className={`text-[8px] font-mono text-muted-foreground/60 mt-0.5 ${own ? "text-right" : "text-left"}`}
                      >
                        {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* @mention autocomplete */}
        {showMentions && mentionOptions.length > 0 && (
          <div className="border-t border-border bg-card px-3 py-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              <AtSign size={10} className="text-muted-foreground" />
              {mentionOptions.map((name) => (
                <button
                  key={name}
                  onClick={() => insertMention(name)}
                  className="text-[10px] font-mono text-primary bg-primary/10 hover:bg-primary/20 rounded px-2 py-0.5 transition"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Send error */}
        {sendError && (
          <div className="px-3 py-1 border-t border-border">
            <p className="text-[10px] font-mono text-destructive">{sendError}</p>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-border">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !showMentions) handleSend();
              if (e.key === "Escape") setShowMentions(false);
            }}
            placeholder={needsDisplayName ? "Set a display name to chat..." : "Message holders... (use @name to mention)"}
            disabled={sending || needsDisplayName}
            maxLength={500}
            className="font-mono text-sm"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim() || needsDisplayName} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
