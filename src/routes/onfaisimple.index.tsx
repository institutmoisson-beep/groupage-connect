import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PackageCheck, TrendingUp, Timer, Sparkles } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ProgressBar } from "@/components/ProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import {
  OFS_CATEGORIES,
  OFS_CATEGORY_LABELS,
  OFS_PRODUCT_STATUS_LABELS,
  ofsReturnPercent,
} from "@/lib/onfaisimple";

export const Route = createFileRoute("/onfaisimple/")({
  head: () => ({
    meta: [
      { title: "OnFaiSimple™ — Sourcing participatif géré par MSN Courtier" },
      {
        name: "description",
        content:
          "Financez des lots de produits chinois à forte marge, MSN Courtier gère l'achat, le transit et la revente locale. Capital et profit crédités sur votre portefeuille.",
      },
      { property: "og:title", content: "OnFaiSimple™ — On fait simple, vous encaissez" },
      {
        property: "og:description",
        content:
          "Catalogue de lots à financer, suivi en 7 étapes, paiement Wallet / Mobile Money / USDT, gain crédité automatiquement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnFaiSimpleCatalog,
});

function OnFaiSimpleCatalog() {
  const [cat, setCat] = useState<string>("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["ofs-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_products")
        .select("*")
        .neq("status", "hidden")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(
    () => (cat === "all" ? products : products.filter((p) => p.category === cat)),
    [products, cat],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-3 pb-6">
        <section className="mt-3 overflow-hidden rounded-2xl bg-ofs-navy p-4 text-ofs-onnavy shadow-ofs">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ofs-gold text-ofs-navy">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-black leading-none">
                OnFaiSimple<sup className="text-[10px]">™</sup>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ofs-gold">
                by MSN Courtier
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed opacity-90">
            Vous financez un lot, nous achetons en Chine, dédouanons et revendons via notre réseau.
            Capital + profit crédités automatiquement sur votre portefeuille.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Sourcing", v: "Chine vérifiée" },
              { k: "Suivi", v: "7 étapes" },
              { k: "Cycle", v: "30–45 jours" },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-ofs-navy-soft px-2 py-2">
                <div className="text-[9px] uppercase tracking-wider text-ofs-gold">{x.k}</div>
                <div className="text-[11px] font-bold">{x.v}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">Lots ouverts au financement</h2>
          <Link
            to="/onfaisimple/orders"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Mes mandats →
          </Link>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {["all", ...OFS_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                cat === c
                  ? "bg-ofs-navy text-ofs-onnavy"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c === "all" ? "Tous" : OFS_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">Chargement du catalogue…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Aucun lot dans cette catégorie pour le moment.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {filtered.map((p) => {
              const images = Array.isArray(p.images) ? (p.images as string[]) : [];
              const remaining = Math.max(0, p.total_units - p.funded_units);
              return (
                <li key={p.id}>
                  <Link
                    to="/onfaisimple/$productId"
                    params={{ productId: p.id }}
                    className="flex gap-3 rounded-2xl bg-card p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-ofs"
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <OptimizedImage
                        src={images[0] ?? "/images/prod-drill.jpg"}
                        alt={p.title}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                          {p.title}
                        </h3>
                        <span className="shrink-0 rounded-md bg-ofs-emerald/12 px-1.5 py-0.5 text-[10px] font-bold text-ofs-emerald">
                          +{ofsReturnPercent(p)}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {OFS_CATEGORY_LABELS[p.category] ?? p.category} ·{" "}
                        {OFS_PRODUCT_STATUS_LABELS[p.status]}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2 text-xs">
                        <span className="font-black text-ofs-navy">{formatXOF(p.unit_cost)}</span>
                        <span className="text-muted-foreground">
                          → revente {formatXOF(p.projected_retail_price)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar current={p.funded_units} target={p.total_units} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                        <Timer className="h-3 w-3" /> {p.estimated_days} j
                        <TrendingUp className="ml-1 h-3 w-3" /> {remaining} unité(s) libres
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ofs-gold" />
          Les projections de marge reposent sur les prix de marché constatés à Abidjan et ne
          constituent pas une garantie de rendement.
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
