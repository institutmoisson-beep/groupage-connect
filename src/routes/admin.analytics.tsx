import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, Search, Smartphone, Users, UserCheck, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRESENCE_CHANNEL } from "@/lib/analytics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Activité & audience — MSN Admin" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsPage,
});

type Ev = {
  session_id: string;
  user_id: string | null;
  event_type: string;
  path: string;
  search_term: string | null;
  search_context: string | null;
  device: string | null;
  referrer: string | null;
  created_at: string;
};

type LiveUser = { key: string; path: string; user_id: string | null };

const RANGES = [
  { d: 1, label: "24 h" },
  { d: 7, label: "7 jours" },
  { d: 30, label: "30 jours" },
];

function useLiveUsers() {
  const [live, setLive] = useState<LiveUser[]>([]);
  useEffect(() => {
    const ch = supabase.channel(PRESENCE_CHANNEL + "-admin-watch");
    // Watch the same presence channel without tracking self twice
    const watch = supabase.channel(PRESENCE_CHANNEL);
    const sync = () => {
      const state = watch.presenceState() as Record<string, Array<{ path?: string; user_id?: string | null }>>;
      setLive(
        Object.entries(state).map(([key, metas]) => ({
          key,
          path: metas[metas.length - 1]?.path ?? "/",
          user_id: metas[metas.length - 1]?.user_id ?? null,
        })),
      );
    };
    watch.on("presence", { event: "sync" }, sync).subscribe();
    const t = setInterval(sync, 5000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(watch);
      void supabase.removeChannel(ch);
    };
  }, []);
  return live;
}

function topN(map: Map<string, number>, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const live = useLiveUsers();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-analytics", days],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const out: Ev[] = [];
      for (let from = 0; from < 50_000; from += 1000) {
        const { data, error } = await supabase
          .from("app_events")
          .select("session_id,user_id,event_type,path,search_term,search_context,device,referrer,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        out.push(...(data as Ev[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });

  const s = useMemo(() => {
    const views = events.filter((e) => e.event_type === "page_view");
    const searches = events.filter((e) => e.event_type === "search");
    const sessions = new Set(views.map((e) => e.session_id));
    const members = new Set(events.filter((e) => e.user_id).map((e) => e.user_id));
    const pages = new Map<string, number>();
    const terms = new Map<string, number>();
    const ctx = new Map<string, number>();
    const devices = new Map<string, number>();
    const refs = new Map<string, number>();
    const hours = new Array(24).fill(0) as number[];
    const daily = new Map<string, { views: number; visitors: Set<string> }>();
    for (const e of views) {
      pages.set(e.path, (pages.get(e.path) ?? 0) + 1);
      if (e.device) devices.set(e.device, (devices.get(e.device) ?? 0) + 1);
      if (e.referrer) {
        let h = e.referrer;
        try { h = new URL(e.referrer).hostname; } catch { /* keep */ }
        refs.set(h, (refs.get(h) ?? 0) + 1);
      }
      const d = new Date(e.created_at);
      hours[d.getHours()]++;
      const k = e.created_at.slice(0, 10);
      const row = daily.get(k) ?? { views: 0, visitors: new Set<string>() };
      row.views++;
      row.visitors.add(e.session_id);
      daily.set(k, row);
    }
    for (const e of searches) {
      if (e.search_term) terms.set(e.search_term, (terms.get(e.search_term) ?? 0) + 1);
      if (e.search_context) ctx.set(e.search_context, (ctx.get(e.search_context) ?? 0) + 1);
    }
    const dailyRows: Array<{ day: string; views: number; visitors: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const r = daily.get(k);
      dailyRows.push({ day: k, views: r?.views ?? 0, visitors: r?.visitors.size ?? 0 });
    }
    return {
      views: views.length,
      visitors: sessions.size,
      members: members.size,
      searches: searches.length,
      pages: topN(pages, 12),
      terms: topN(terms, 15),
      ctx: topN(ctx),
      devices: topN(devices),
      refs: topN(refs, 8),
      hours,
      dailyRows,
      recent: events.slice(0, 25),
    };
  }, [events, days]);

  const livePages = useMemo(() => {
    const m = new Map<string, number>();
    live.forEach((u) => m.set(u.path, (m.get(u.path) ?? 0) + 1));
    return topN(m, 8);
  }, [live]);

  const maxDaily = Math.max(1, ...s.dailyRows.map((r) => r.visitors));
  const maxHour = Math.max(1, ...s.hours);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Activité & audience</h1>
          <p className="text-sm text-muted-foreground">Ce que font les utilisateurs sur MSN Courtier.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/40 p-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.d}
              onClick={() => setDays(r.d)}
              className={`rounded-md px-3 py-1.5 font-semibold ${days === r.d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<Activity className="h-4 w-4 text-primary" />} label="En ligne maintenant" value={live.length} live />
        <Stat icon={<Users className="h-4 w-4" />} label="Visiteurs" value={s.visitors} />
        <Stat icon={<UserCheck className="h-4 w-4" />} label="Membres connectés" value={s.members} />
        <Stat icon={<Eye className="h-4 w-4" />} label="Pages vues" value={s.views} />
        <Stat icon={<Search className="h-4 w-4" />} label="Recherches" value={s.searches} />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement des données…</p>}

      <Panel title="Visiteurs par jour">
        <div className="flex h-40 items-end gap-1">
          {s.dailyRows.map((r) => (
            <div key={r.day} className="group flex flex-1 flex-col items-center gap-1" title={`${r.day} : ${r.visitors} visiteurs, ${r.views} pages`}>
              <span className="text-[9px] text-muted-foreground">{r.visitors || ""}</span>
              <div className="w-full rounded-t bg-gradient-brand" style={{ height: `${(r.visitors / maxDaily) * 120}px`, minHeight: 2 }} />
              {days > 1 && <span className="text-[9px] text-muted-foreground">{r.day.slice(8)}</span>}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`En direct (${live.length})`}>
          {livePages.length === 0 ? <Empty /> : <Bars rows={livePages} />}
        </Panel>
        <Panel title="Mots les plus recherchés">
          {s.terms.length === 0 ? <Empty /> : <Bars rows={s.terms} />}
        </Panel>
        <Panel title="Pages les plus visitées">
          {s.pages.length === 0 ? <Empty /> : <Bars rows={s.pages} />}
        </Panel>
        <Panel title="Rubriques où l'on cherche">
          {s.ctx.length === 0 ? <Empty /> : <Bars rows={s.ctx} />}
        </Panel>
        <Panel title="Heures d'affluence">
          <div className="flex h-28 items-end gap-0.5">
            {s.hours.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center" title={`${i}h : ${h} pages`}>
                <div className="w-full rounded-t bg-secondary" style={{ height: `${(h / maxHour) * 90}px`, minHeight: 1 }} />
                {i % 3 === 0 && <span className="text-[9px] text-muted-foreground">{i}h</span>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Appareils & provenance">
          <div className="space-y-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground"><Smartphone className="h-3 w-3" /> Appareils</div>
            {s.devices.length === 0 ? <Empty /> : <Bars rows={s.devices.map(([k, v]) => [k === "mobile" ? "Mobile" : k === "tablet" ? "Tablette" : "Ordinateur", v])} />}
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground"><Globe className="h-3 w-3" /> Sites d'origine</div>
            {s.refs.length === 0 ? <p className="text-xs text-muted-foreground">Accès direct uniquement</p> : <Bars rows={s.refs} />}
          </div>
        </Panel>
      </div>

      <Panel title="Activité récente">
        <ul className="divide-y divide-border text-xs">
          {s.recent.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate">
                {e.event_type === "search" ? (
                  <>🔍 a recherché <b>« {e.search_term} »</b> <span className="text-muted-foreground">({e.search_context})</span></>
                ) : (
                  <>👁 a visité <b>{e.path}</b></>
                )}
                <span className="ml-1 text-muted-foreground">{e.user_id ? "· membre" : "· visiteur"}</span>
              </span>
              <span className="shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
            </li>
          ))}
          {s.recent.length === 0 && <Empty />}
        </ul>
      </Panel>
    </div>
  );
}

function Stat({ icon, label, value, live }: { icon: React.ReactNode; label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-black">{value.toLocaleString("fr-FR")}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-4 shadow-card">
      <h2 className="mb-3 font-display text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="space-y-1.5">
      {rows.map(([k, v]) => (
        <li key={k} className="text-xs">
          <div className="flex justify-between gap-2">
            <span className="truncate">{k}</span>
            <span className="font-semibold">{v}</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded bg-muted">
            <div className="h-1.5 rounded bg-gradient-brand" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground">Aucune donnée pour le moment.</p>;
}
