import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Image as ImageIcon,
  X,
  Mic,
  Square,
  Trash2,
  Check,
  CheckCheck,
  Play,
  Pause,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { uploadDirectMessageAudio, uploadDirectMessageImage } from "@/lib/direct-message-upload";

type Message = {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  body: string;
  image_urls: string[] | null;
  audio_url: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Canal de messagerie personnel entre l'admin (MSN Courtier) et UN client donné
 * (identifié par channelUserId). Contrairement à SourcingChat, ce fil n'est pas
 * rattaché à une demande de sourcing précise : c'est la discussion générale du
 * client avec MSN. Texte, images et messages vocaux dans les deux sens.
 */
export function DirectChat({
  channelUserId,
  currentUserId,
  viewAsAdmin,
  compact,
}: {
  channelUserId: string;
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
  const [recording, setRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    data: messages,
    isError,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["direct-messages", channelUserId],
    refetchInterval: 4000, // repli si le Realtime n'est pas actif sur ce projet
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages" as any)
        .select("*")
        .eq("user_id", channelUserId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
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
      .channel(`direct-chat-${channelUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `user_id=eq.${channelUserId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["direct-messages", channelUserId] }),
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "Direct chat realtime unavailable, falling back to polling only:",
            status,
            err,
          );
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelUserId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Marque comme lus les messages reçus pendant que ce fil est ouvert (accusés de lecture ✓✓).
  useEffect(() => {
    supabase
      .from("direct_messages" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", channelUserId)
      .is("read_at", null)
      .neq("sender_id", currentUserId)
      .then(() => {});
  }, [channelUserId, currentUserId, messages?.length]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length < files.length) toast.error("Seules les images sont acceptées");
    setPendingFiles((prev) => [...prev, ...imgs].slice(0, 6));
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecordedAudio(new Blob(chunksRef.current, { type: mime }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordedAudio(null);
      setRecordSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error(
        "Micro indisponible : autorisez l'accès au microphone pour enregistrer un vocal.",
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function discardRecording() {
    setRecordedAudio(null);
    setRecordSeconds(0);
  }

  async function send() {
    if (!text.trim() && pendingFiles.length === 0 && !recordedAudio) return;
    setSending(true);
    try {
      const imageUrls: string[] = [];
      if (pendingFiles.length > 0) {
        setUploadProgress({ done: 0, total: pendingFiles.length });
        for (const file of pendingFiles) {
          const url = await uploadDirectMessageImage(file, channelUserId);
          imageUrls.push(url);
          setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      }
      let audioUrl: string | null = null;
      if (recordedAudio) {
        audioUrl = await uploadDirectMessageAudio(recordedAudio, channelUserId);
      }
      const { error } = await supabase.from("direct_messages" as any).insert({
        user_id: channelUserId,
        sender_id: currentUserId,
        body: text.trim(),
        image_urls: imageUrls,
        audio_url: audioUrl,
      } as never);
      if (error) throw error;
      setText("");
      setPendingFiles([]);
      setRecordedAudio(null);
      setRecordSeconds(0);
      qc.invalidateQueries({ queryKey: ["direct-messages", channelUserId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const canSend = !sending && (!!text.trim() || pendingFiles.length > 0 || !!recordedAudio);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/40 to-card">
      <div
        className={`flex-1 space-y-3 overflow-y-auto p-3 ${compact ? "max-h-64" : "max-h-[65vh]"}`}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (messages ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-brand">
              <Send className="h-5 w-5" />
            </div>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Aucun message pour l'instant.{" "}
              {viewAsAdmin ? "Écrivez à ce client" : "Écrivez à MSN Courtier"} — texte, photo ou
              message vocal.
            </p>
          </div>
        ) : (
          messages!.map((m, idx) => {
            const mine = m.sender_id === currentUserId;
            const prev = messages![idx - 1];
            const grouped = prev && prev.sender_id === m.sender_id;
            const images = m.image_urls ?? [];
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}
              >
                {!mine && !grouped && (
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary/15 text-[9px] font-black text-secondary">
                    {m.sender_role === "admin" ? "M" : "C"}
                  </div>
                )}
                {!mine && grouped && <div className="w-6 shrink-0" />}
                <div
                  className={`max-w-[78%] px-3 py-2 text-xs shadow-sm ${
                    mine
                      ? `bg-gradient-brand text-primary-foreground ${grouped ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                      : `bg-card text-foreground ${grouped ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"} border border-border/60`
                  }`}
                >
                  {!grouped && (
                    <div
                      className={`mb-0.5 text-[9px] font-bold uppercase tracking-wide ${mine ? "opacity-75" : "text-secondary"}`}
                    >
                      {m.sender_role === "admin" ? "MSN Courtier" : "Client"}
                    </div>
                  )}
                  {images.length > 0 && (
                    <div
                      className={`mb-1 grid gap-1 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                    >
                      {images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightbox(img)}
                          className="block aspect-square overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:opacity-90"
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
                  {m.audio_url && <VoiceBubble src={m.audio_url} mine={mine} />}
                  {m.body && <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>}
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${mine ? "opacity-75" : "opacity-50"}`}
                  >
                    {new Date(m.created_at).toLocaleString("fr-CI", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine &&
                      (m.read_at ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card p-2">
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

      {recordedAudio && (
        <div className="flex items-center gap-2 border-t border-border bg-card p-2">
          <div className="flex-1">
            <VoiceBubble src={URL.createObjectURL(recordedAudio)} mine preview />
          </div>
          <button
            type="button"
            onClick={discardRecording}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"
            aria-label="Supprimer l'enregistrement"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {uploadProgress && (
        <div className="border-t border-border bg-card px-3 py-1 text-[10px] text-muted-foreground">
          Envoi en cours… {uploadProgress.done}/{uploadProgress.total}
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2 border-t border-border bg-card p-2">
          <span className="flex h-9 flex-1 items-center gap-2 rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive">
            <span className="flex items-center gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-0.5 animate-pulse rounded-full bg-destructive"
                  style={{ height: `${6 + (i % 3) * 4}px`, animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
            Enregistrement… {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
            {String(recordSeconds % 60).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
            aria-label="Arrêter l'enregistrement"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border bg-card p-2">
          {/* <label> lié à l'input caché plutôt qu'un bouton + ref.click() : plus fiable
             sur mobile/PWA qu'un déclenchement JS d'un input display:none. */}
          <label
            htmlFor={`direct-chat-file-input-${channelUserId}`}
            aria-disabled={sending}
            className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70 ${
              sending ? "pointer-events-none opacity-60" : ""
            }`}
            aria-label="Joindre une image"
            title="Joindre une ou plusieurs images"
          >
            <ImageIcon className="h-4 w-4" />
          </label>
          <input
            id={`direct-chat-file-input-${channelUserId}`}
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            disabled={sending}
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={startRecording}
            disabled={sending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70 disabled:opacity-60"
            aria-label="Enregistrer un message vocal"
            title="Enregistrer un message vocal"
          >
            <Mic className="h-4 w-4" />
          </button>
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
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-brand transition disabled:opacity-50"
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}

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

/** Petit lecteur audio "moderne" (play/pause + barre de progression + durée) pour les vocaux. */
function VoiceBubble({ src, mine, preview }: { src: string; mine: boolean; preview?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => {
      setCurrent(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const ratio = Number(e.target.value);
    audio.currentTime = ratio * duration;
    setProgress(ratio);
  }

  function fmt(s: number) {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div
      className={`mb-1 flex w-56 max-w-full items-center gap-2 rounded-full px-1 py-1 ${mine ? "bg-white/15" : "bg-muted"}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          mine ? "bg-white/90 text-primary" : "bg-gradient-brand text-primary-foreground"
        }`}
        aria-label={playing ? "Pause" : "Lire"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={seek}
        className="h-1 flex-1 accent-current"
        aria-label="Progression du vocal"
      />
      <span
        className={`shrink-0 pr-1 text-[9px] tabular-nums ${mine ? "opacity-80" : "text-muted-foreground"}`}
      >
        {preview ? fmt(duration) : fmt(playing ? current : duration)}
      </span>
    </div>
  );
}
