import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notification-sound";

/**
 * Monté une seule fois dans le layout /admin. Écoute en direct tous les nouveaux
 * messages clients (messagerie directe + fils de sourcing), joue le carillon et
 * affiche un toast, que l'admin ait ou non le fil concerné ouvert à l'écran.
 */
export function AdminInboxWatcher() {
  useEffect(() => {
    const channel = supabase
      .channel("admin-inbox-watcher")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as { sender_role?: string; body?: string } | null;
          if (row?.sender_role !== "user") return; // ignore ses propres envois admin
          playNotificationSound();
          toast.message("Nouveau message client", {
            description: row.body?.slice(0, 80) || "Pièce jointe reçue",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sourcing_messages" },
        (payload) => {
          const row = payload.new as { sender_role?: string; body?: string } | null;
          if (row?.sender_role !== "user") return;
          playNotificationSound();
          toast.message("Nouveau message sourcing", {
            description: row.body?.slice(0, 80) || "Pièce jointe reçue",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
