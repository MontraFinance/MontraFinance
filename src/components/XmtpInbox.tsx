import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Inbox, RefreshCw, Loader2 } from "lucide-react";
import { getConversations, getXmtpClient, initXmtpClient, createDm } from "@/lib/xmtp";
import { XmtpChat } from "./XmtpChat";

interface ConversationItem {
  conversation: any;
  peerAddress: string;
  lastMessage?: string;
}

interface XmtpInboxProps {
  walletProvider: any;
  selfAddress: string;
  initialPeer?: string | null;
  initialPeerName?: string | null;
}

export function XmtpInbox({ walletProvider, selfAddress, initialPeer, initialPeerName }: XmtpInboxProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const peerHandled = useRef(false);

  const connect = async () => {
    setLoading(true);
    try {
      if (!walletProvider) throw new Error("No wallet provider available");
      await initXmtpClient(walletProvider);
      setConnected(true);
      await loadConversations();
    } catch (err) {
      console.error("XMTP connect failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const convos = await getConversations();
      const mapped: ConversationItem[] = [];

      for (const convo of convos) {
        try {
          await convo.sync();
          const msgs = await convo.messages();
          const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          const content = last
            ? (typeof last.content === "string" ? last.content : last.content?.text || "")
            : undefined;

          // Extract peer identifier — could be a string inboxId or an object
          let peerLabel = "Montra Bot";
          try {
            const raw = convo.peerInboxId ?? convo.dmPeerInboxId;
            if (typeof raw === "string" && raw.length > 0 && !raw.includes("async")) {
              peerLabel = raw.slice(0, 8) + "...";
            }
          } catch {
            // fallback to default
          }

          mapped.push({
            conversation: convo,
            peerAddress: peerLabel,
            lastMessage: content,
          });
        } catch {
          // Skip conversations that fail to load
        }
      }

      setConversations(mapped);
      return mapped;
    } catch (err) {
      console.error("Failed to load conversations:", err);
      return [];
    }
  };

  const [peerError, setPeerError] = useState<string | null>(null);

  // Auto-open chat with peer from query param after connecting
  useEffect(() => {
    if (!connected || !initialPeer || peerHandled.current) return;
    peerHandled.current = true;

    (async () => {
      setStartingChat(true);
      setPeerError(null);
      try {
        const convo = await createDm(initialPeer);
        setSelectedConvo({
          conversation: convo,
          peerAddress: initialPeerName || initialPeer,
        });
      } catch (err: any) {
        console.error("Failed to start DM with peer:", err);
        const msg = err?.message || "";
        if (msg.includes("not on XMTP")) {
          setPeerError("This address hasn't joined XMTP yet. The Montra bot will be available soon — try again later or start a new conversation below.");
        } else {
          setPeerError(`Could not start conversation: ${msg}`);
        }
      } finally {
        setStartingChat(false);
      }
    })();
  }, [connected, initialPeer]);

  useEffect(() => {
    if (getXmtpClient()) {
      setConnected(true);
      loadConversations();
    }
  }, []);

  if (selectedConvo) {
    return (
      <div className="h-[500px]">
        <XmtpChat
          conversation={selectedConvo.conversation}
          peerAddress={selectedConvo.peerAddress}
          selfAddress={selfAddress}
          onClose={() => setSelectedConvo(null)}
        />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm text-center">
          Connect to XMTP to send encrypted messages to agents and other wallets.
        </p>
        <Button onClick={connect} disabled={loading}>
          {loading ? "Connecting..." : "Connect XMTP"}
        </Button>
      </div>
    );
  }

  if (startingChat) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm text-center">
          Starting conversation with {initialPeer?.slice(0, 6)}...{initialPeer?.slice(-4)}
        </p>
      </div>
    );
  }

  if (peerError) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center gap-3 p-6 bg-destructive/5 border border-destructive/20 rounded-lg">
          <MessageSquare className="h-8 w-8 text-destructive/60" />
          <p className="text-sm text-center text-muted-foreground">{peerError}</p>
          <Button variant="outline" size="sm" onClick={() => setPeerError(null)}>
            View Inbox
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          <span className="font-medium text-sm">Messages</span>
        </div>
        <Button variant="ghost" size="icon" onClick={loadConversations}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        {conversations.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm p-4">
            No conversations yet.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((item, i) => (
              <button
                key={i}
                onClick={() => setSelectedConvo(item)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <MessageSquare className="h-4 w-4 mt-1 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs truncate">
                    {item.peerAddress}
                  </p>
                  {item.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.lastMessage}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
