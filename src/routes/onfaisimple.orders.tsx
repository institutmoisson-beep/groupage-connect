import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, PackageCheck, Wallet } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  OFS_PAYMENT_STATUS_LABELS,
  OFS_STAGES,
  OFS_STAGE_HINTS,
  OFS_STAGE_LABELS,
  type OfsStage,
} from "@/lib/onfaisimple";

export const Route = createFileRoute("/onfaisimple/orders")({
  head: () => ({
    meta: [
      { title: "Mes mandats OnFaiSimple™ — suivi en 7 étapes | MSN Courtier" },
      {
        name: "description",
        content:
          "Suivez chaque lot financé : achat en Chine, entrepôt, transit, dédouanement, mise en vente et clôture du gain.",
      },
      { property: "og:title", content: "Mes mandats OnFaiSimple™" },
      {
        property: "og:description",
        content: "Traçabilité en temps réel de vos lots financés et de vos gains crédités.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnFaiSimpleOrders,
});

function OnFaiSimpleOrders() {
  const { user, loading } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const chimedRef = useRef<Set<string>>(new Set());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["ofs-orders", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_orders")
        .select("*, onfaisimple_products(title, images, estimated_days)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["ofs-events", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_stage_events")
        .select("*")
        .eq("order_id", openId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Chime lorsqu'un mandat vient d'être clôturé avec gain crédité.
  useEffect(() => {
    for (const o of orders) {
      if (o.current_stage === "GAIN_CLOTURE" && !chimedRef.current.has(o.id)) {
        chimedRef.current.add(o.id);
        if (o.payout_credited_at) playNotificationSound();
      }
    }
  }, [orders]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-3 pb-8">
        <div className="mt-3 flex items-center justify-between">
          <h1 className="font-display text-base font-black">Mes mandats OnFaiSimple™</h1>
          <Link to="/onfaisimple" className="text-[11px] font-semibold text-primary">
            Catalogue →
          </Link>
        </div>

        {!user ? (
          <Link
            to="/auth"
            search={{ redirect: "/onfaisimple/orders" } as never}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ofs-navy py-3 text-sm font-bold text-ofs-onnavy"
          >
            Se connecter pour voir mes mandats
          </Link>
        ) : isLoading ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">Chargement…</p>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-card p-5 text-center shadow-card">
            <PackageCheck className="mx-auto h-8 w-8 text-ofs-gold" />
            <p className="mt-2 text-sm font-semibold">Aucun mandat pour l'instant</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisissez un lot dans le catalogue et laissez-nous gérer le reste.
            </p>
            <Link
              to="/onfaisimple"
              className="mt-3 inline-block rounded-xl bg-ofs-gold px-4 py-2 text-xs font-bold text-ofs-navy"
            >
              Voir les lots ouverts
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {orders.map((o) => {
              const product = o.onfaisimple_products as {
                title: string;
                images: unknown;
                estimated_days: number;
              } | null;
              const stageIndex = OFS_STAGES.indexOf(o.current_stage as OfsStage);
              const open = openId === o.id;
              return (
                <li key={o.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
                  <button
                    onClick={() => setOpenId(open ? null : o.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold">
                          {product?.title ?? "Lot OnFaiSimple"}
                        </h2>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {o.contract_reference} · {o.units_count} unité(s)
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          o.payment_status === "approved"
                            ? "bg-ofs-emerald/12 text-ofs-emerald"
                            : o.payment_status === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-ofs-gold/15 text-ofs-goldink"
                        }`}
                      >
                        {OFS_PAYMENT_STATUS_LABELS[o.payment_status]}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-muted/50 p-2">
                        <div className="text-[10px] text-muted-foreground">Capital engagé</div>
                        <div className="font-bold">{formatXOF(Number(o.total_amount))}</div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-2">
                        <div className="text-[10px] text-muted-foreground">Versement attendu</div>
                        <div className="font-bold text-ofs-emerald">
                          {formatXOF(Number(o.expected_payout))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      {OFS_STAGES.map((s, i) => (
                        <span
                          key={s}
                          className={`h-1.5 flex-1 rounded-full ${
                            i <= stageIndex ? "bg-ofs-gold" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-ofs-navy">
                      {OFS_STAGE_LABELS[o.current_stage as OfsStage]} · étape {stageIndex + 1}/7
                    </div>
                    {o.payout_credited_at && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-ofs-emerald">
                        <Wallet className="h-3.5 w-3.5" /> Gain crédité sur votre portefeuille
                      </div>
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-border bg-muted/20 p-3">
                      <ol className="space-y-2.5">
                        {OFS_STAGES.map((s, i) => {
                          const done = i <= stageIndex;
                          const ev = events.find((e) => e.stage === s);
                          return (
                            <li key={s} className="flex gap-2">
                              <span className="mt-0.5">
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 text-ofs-emerald" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-xs font-semibold ${done ? "" : "text-muted-foreground"}`}
                                >
                                  {i + 1}. {OFS_STAGE_LABELS[s]}
                                </div>
                                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                                  {ev?.note ?? OFS_STAGE_HINTS[s]}
                                </p>
                                {ev?.tracking_code && (
                                  <div className="mt-0.5 text-[10px] font-semibold text-ofs-navy">
                                    Suivi cargo : {ev.tracking_code}
                                  </div>
                                )}
                                {ev?.photo_url && (
                                  <a
                                    href={ev.photo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-block text-[10px] font-semibold text-primary underline"
                                  >
                                    Voir la photo
                                  </a>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                      {o.cargo_tracking_code && (
                        <div className="mt-3 rounded-xl bg-card p-2 text-[11px]">
                          Code de suivi MSN Cargo :{" "}
                          <strong className="font-black">{o.cargo_tracking_code}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
