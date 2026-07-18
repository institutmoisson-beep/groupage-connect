import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Loader2, MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  sourcing_order_id: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Boîte de notifications de l'utilisateur : reçoit automatiquement une entrée
 * chaque fois que l'admin (MSN Courtier) répond dans une discussion de sourcing,
 * même si le client n'est pas en train de regarder cette discussion.
 */
export function NotificationBell({ userId }: { userId?: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["user-notifications", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notifications" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["user-notifications", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  async function openNotification(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      await supabase
        .from("user_notifications" as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["user-notifications", userId] });
    }
    if (n.link) navigate({ to: n.link as never });
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;
    await supabase
      .from("user_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["user-notifications", userId] });
  }

  if (!userId) {
    return (
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        aria-label="Notifications"
        disabled
      >
        <Bell className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 max-h-[70vh] w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-bold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] font-semibold text-primary"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (notifications ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aucune notification pour l'instant. Les messages de MSN Courtier apparaîtront ici.
              </p>
            ) : (
              (notifications ?? []).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60 ${
                    n.read_at ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-bold">{n.title}</span>
                      {!n.read_at && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="line-clamp-2 block text-[11px] text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("fr-CI", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
