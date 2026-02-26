import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, MessageSquare } from "lucide-react";
import { getMessages, sendMessage } from "@/lib/xmtp";

interface XmtpChatProps {
  conversation: any;
  peerAddress: string;
  selfAddress: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  content: string;
  senderInboxId: string;
  sentAtNs: bigint;
}

/** Extract displayable text from a message, or null if it's a system/metadata message */
function extractText(msg: any): string | null {
  const c = msg.content;
  // Plain text
  if (typeof c === "string") return c;
  // Object with text field
  if (c?.text && typeof c.text === "string") return c.text;
  // Skip metadata/group-update messages (they have initiatedByInboxId, inboxId arrays, etc.)
  if (c?.initiatedByInboxId || c?.metadataFieldChanges || c?.addedInboxes || c?.removedInboxes) {
    return null;
  }
  // Skip if content is not meaningful text
  if (typeof c === "object") return null;
  return null;
}

export function XmtpChat({ conversation, peerAddress, selfAddress, onClose }: XmtpChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clientInboxId = useRef<string>("");

  useEffect(() => {
    async function load() {
      try {
        const { getXmtpClient } = await import("@/lib/xmtp");
        const client = getXmtpClient();
        if (client) clientInboxId.current = client.inboxId;

        const msgs = await getMessages(conversation);
        setMessages(
          msgs.map((m: any) => ({
            id: m.id,
            content: extractText(m),
            senderInboxId: m.senderInboxId,
            sentAtNs: m.sentAtNs,
          })).filter((m: any) => m.content !== null),
        );
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    // Poll for new messages every 3 seconds
    const interval = setInterval(async () => {
      try {
        const msgs = await getMessages(conversation);
        setMessages(
          msgs.map((m: any) => ({
            id: m.id,
            content: extractText(m),
            senderInboxId: m.senderInboxId,
            sentAtNs: m.sentAtNs,
          })).filter((m: any) => m.content !== null),
        );
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [conversation]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(conversation, input.trim());
      setInput("");
      // Refresh messages
      const msgs = await getMessages(conversation);
      setMessages(
        msgs.map((m: any) => ({
          id: m.id,
          content: typeof m.content === "string" ? m.content : m.content?.text || JSON.stringify(m.content),
          senderInboxId: m.senderInboxId,
          sentAtNs: m.sentAtNs,
        })),
      );
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {peerAddress}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm">
            No messages yet. Say hello!
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isSelf = msg.senderInboxId === clientInboxId.current;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isSelf
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          disabled={sending}
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
