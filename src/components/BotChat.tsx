import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, ArrowLeft } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  content: string;
  created_at: string;
}

interface BotChatProps {
  walletAddress: string;
  agentId?: string | null;
  agentName?: string | null;
  onBack?: () => void;
}

export function BotChat({ walletAddress, agentId, agentName, onBack }: BotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load message history
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ wallet: walletAddress });
        if (agentId) params.set("agent", agentId);
        const resp = await fetch(`/api/bot/messages?${params}`);
        if (resp.ok) {
          const json = await resp.json();
          setMessages(json.messages || []);
        }
      } catch {
        // ignore load errors
      } finally {
        setLoading(false);
      }
    })();
  }, [walletAddress, agentId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send greeting on first visit (no messages yet)
  useEffect(() => {
    if (!loading && messages.length === 0) {
      // Add a local bot greeting without API call
      setMessages([{
        id: "greeting",
        sender: "bot",
        content: `Hello! I'm the Montra Bot${agentName ? ` for ${agentName}` : ""}. Send 'help' to see available commands.`,
        created_at: new Date().toISOString(),
      }]);
    }
  }, [loading, messages.length, agentName]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userText = input.trim();
    setInput("");
    setSending(true);

    // Optimistic: add user message immediately
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      sender: "user",
      content: userText,
      created_at: new Date().toISOString(),
    }]);

    try {
      const resp = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          agentId: agentId || undefined,
          message: userText,
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        // Add bot reply
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          sender: "bot",
          content: json.reply,
          created_at: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          sender: "bot",
          content: "Sorry, something went wrong. Try again.",
          created_at: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: "bot",
        content: "Connection error. Please try again.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Bot className="h-4 w-4 text-primary" />
        <span className="font-mono text-sm font-medium">
          {agentName ? `${agentName} — Montra Bot` : "Montra Bot"}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Online
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading messages...</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a command (help, status, pnl, trades)..."
          disabled={sending}
          className="font-mono text-sm"
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
