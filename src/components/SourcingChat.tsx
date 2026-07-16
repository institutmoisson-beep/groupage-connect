import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  sourcing_order_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

export function SourcingChat({
  sourcingOrderId,
  currentUserId,
  viewAsAdmin,
  compact,
}: {
  sourcingOrderId: string;
  currentUserId: string;
  viewAsAdmin: boolean;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["sourcing-messages", sourcingOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_messages" as any)
        .select("*")
        .eq("sourcing_order_id", sourcingOrderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`sourcing-chat-${sourcingOrderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sourcing_messages", filter: `sourcing_order_id=eq.${sourcingOrderId}` },
        () => qc.invalidateQueries({ queryKey: ["sourcing-messages", sourcingOrderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sourcingOrderId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("sourcing_messages" as any).insert({
        sourcing_order_id: sourcingOrderId,
        sender_id: currentUserId,
        body: text.trim(),
      } as never);
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["sourcing-messages", sourcingOrderId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className={`flex-1 space-y-2 overflow-y-auto p-3 ${compact ? "max-h-64" : "max-h-[60vh]"}`}>
        {(messages ?? []).length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Aucun message. {viewAsAdmin ? "Écrivez au client" : "Écrivez à MSN"} pour discuter de ce produit.
          </p>
        ) : (
          messages!.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    mine ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <div className="mb-0.5 text-[9px] font-bold uppercase opacity-70">
                    {m.sender_role === "admin" ? "MSN Courtier" : "Client"}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  <div className="mt-0.5 text-right text-[9px] opacity-60">
                    {new Date(m.created_at).toLocaleString("fr-CI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Écrire un message…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand disabled:opacity-60"
          aria-label="Envoyer"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
