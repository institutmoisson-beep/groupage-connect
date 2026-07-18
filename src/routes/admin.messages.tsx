import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DirectChat } from "@/components/DirectChat";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessages,
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
};

type LastMessageRow = {
  user_id: string;
  body: string;
  sender_role: "user" | "admin";
  created_at: string;
  read_at: string | null;
};

function AdminMessages() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, city")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  // Dernier message de chaque canal, pour l'aperçu + le tri + le badge non-lu.
  const { data: lastMessages } = useQuery({
    queryKey: ["admin-direct-messages-preview"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages" as any)
        .select("user_id, body, sender_role, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as LastMessageRow[];
    },
  });

  const previewByUser = useMemo(() => {
    const map = new Map<string, LastMessageRow>();
    for (const m of lastMessages ?? []) {
      if (!map.has(m.user_id)) map.set(m.user_id, m);
    }
    return map;
  }, [lastMessages]);

  const unreadByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of lastMessages ?? []) {
      if (m.sender_role === "user" && !m.read_at) {
        map.set(m.user_id, (map.get(m.user_id) ?? 0) + 1);
      }
    }
    return map;
  }, [lastMessages]);

  const filtered = (profiles ?? [])
    .filter((p) =>
      !q
        ? true
        : (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (p.phone ?? "").includes(q),
    )
    .slice()
    .sort((a, b) => {
      const ta = previewByUser.get(a.id)?.created_at ?? "";
      const tb = previewByUser.get(b.id)?.created_at ?? "";
      return tb.localeCompare(ta);
    });

  const selectedProfile =
    filtered.find((p) => p.id === selected) ?? profiles?.find((p) => p.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <h1 className="font-display text-xl font-black">Messagerie personnelle</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un client…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1.5">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Aucun utilisateur</p>
          ) : (
            filtered.map((p) => {
              const preview = previewByUser.get(p.id);
              const unread = unreadByUser.get(p.id) ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    selected === p.id ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-xs font-bold text-secondary">
                    {(p.full_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold">
                        {p.full_name ?? p.phone ?? "Client"}
                      </span>
                      {unread > 0 && (
                        <span className="grid h-4 min-w-[16px] shrink-0 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {preview
                        ? `${preview.sender_role === "admin" ? "Vous : " : ""}${preview.body || "Pièce jointe"}`
                        : "Aucun message"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        {selectedProfile && user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-3 py-2.5 text-primary-foreground shadow-brand">
              <div className="relative grid h-9 w-9 place-items-center rounded-full bg-white/20 text-xs font-bold backdrop-blur">
                {(selectedProfile.full_name || "?").slice(0, 1).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold">{selectedProfile.full_name ?? "Client"}</div>
                <div className="text-[11px] opacity-85">{selectedProfile.phone ?? "—"}</div>
              </div>
            </div>
            <DirectChat channelUserId={selectedProfile.id} currentUserId={user.id} viewAsAdmin />
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            <MessageCircle className="h-6 w-6" />
            Sélectionnez un client pour ouvrir la discussion.
          </div>
        )}
      </div>
    </div>
  );
}
