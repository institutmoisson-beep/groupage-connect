import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Image as ImageIcon, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { uploadSourcingChatImage } from "@/lib/sourcing-chat-upload";

type Message = {
  id: string;
  sourcing_order_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  body: string;
  image_urls: string[] | null;
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    data: messages,
    isError,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["sourcing-messages", sourcingOrderId],
    refetchInterval: 4000, // fallback in case Realtime isn't enabled on this table in your project
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
    if (isError) {
      toast.error(
        `Impossible de charger la discussion : ${(error as any)?.message ?? "erreur inconnue"}`,
      );
    }
  }, [isError, error]);

  useEffect(() => {
    const channel = supabase
      .channel(`sourcing-chat-${sourcingOrderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sourcing_messages",
          filter: `sourcing_order_id=eq.${sourcingOrderId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["sourcing-messages", sourcingOrderId] }),
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "Sourcing chat realtime unavailable, falling back to polling only:",
            status,
            err,
          );
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sourcingOrderId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length < files.length) toast.error("Seules les images sont acceptées");
    setPendingFiles((prev) => [...prev, ...imgs].slice(0, 6));
  }

  async function send() {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const imageUrls: string[] = [];
      if (pendingFiles.length > 0) {
        setUploadProgress({ done: 0, total: pendingFiles.length });
        for (const file of pendingFiles) {
          const url = await uploadSourcingChatImage(file, sourcingOrderId);
          imageUrls.push(url);
          setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      }
      const { error } = await supabase.from("sourcing_messages" as any).insert({
        sourcing_order_id: sourcingOrderId,
        sender_id: currentUserId,
        body: text.trim(),
        image_urls: imageUrls,
      } as never);
      if (error) throw error;
      setText("");
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ["sourcing-messages", sourcingOrderId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div
        className={`flex-1 space-y-2 overflow-y-auto p-3 ${compact ? "max-h-64" : "max-h-[60vh]"}`}
      >
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (messages ?? []).length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Aucun message. {viewAsAdmin ? "Écrivez au client" : "Écrivez à MSN"} pour discuter de ce
            produit — vous pouvez aussi joindre des photos.
          </p>
        ) : (
          messages!.map((m) => {
            const mine = m.sender_id === currentUserId;
            const images = m.image_urls ?? [];
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
                  {images.length > 0 && (
                    <div
                      className={`mb-1 grid gap-1 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                    >
                      {images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightbox(img)}
                          className="block aspect-square overflow-hidden rounded-lg"
                        >
                          <img
                            src={img}
                            alt="Pièce jointe"
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {m.body && <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>}
                  <div className="mt-0.5 text-right text-[9px] opacity-60">
                    {new Date(m.created_at).toLocaleString("fr-CI", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border p-2">
          {pendingFiles.map((f, i) => (
            <div
              key={i}
              className="relative h-14 w-14 overflow-hidden rounded-lg border border-border"
            >
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-0 top-0 grid h-4 w-4 place-items-center rounded-bl-lg bg-black/60 text-white"
                aria-label="Retirer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploadProgress && (
        <div className="border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
          Optimisation et envoi des images… {uploadProgress.done}/{uploadProgress.total}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border p-2">
        {/* Un <label> lié à l'input caché est utilisé plutôt qu'un bouton + ref.click() :
           ce dernier peut être bloqué (pas d'ouverture du sélecteur de fichiers, "retour en
           haut de page") sur certains navigateurs mobiles / webviews PWA. Le label natif,
           lui, fonctionne toujours, y compris dans l'app admin. */}
        <label
          htmlFor="sourcing-chat-file-input"
          aria-disabled={sending}
          className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-muted text-muted-foreground transition hover:bg-muted/70 ${
            sending ? "pointer-events-none opacity-60" : ""
          }`}
          aria-label="Joindre une image"
          title="Joindre une ou plusieurs images"
        >
          <ImageIcon className="h-4 w-4" />
        </label>
        <input
          id="sourcing-chat-file-input"
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          disabled={sending}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            // permet de re-sélectionner le même fichier une seconde fois si besoin
            e.target.value = "";
          }}
        />
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
          type="button"
          onClick={send}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand disabled:opacity-60"
          aria-label="Envoyer"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="Pièce jointe"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
