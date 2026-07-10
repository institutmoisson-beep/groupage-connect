import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Ship, Sparkles, TrendingUp, ArrowRight } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ProgressBar } from "@/components/ProgressBar";
import {
  productsQuery,
  campaignsQuery,
  campaignProductsQuery,
  activeCampaignForProduct,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(productsQuery());
    context.queryClient.ensureQueryData(campaignsQuery());
    context.queryClient.ensureQueryData(campaignProductsQuery());
  },
  component: Index,
});

function Index() {
  const { data: products } = useSuspenseQuery(productsQuery());
  const { data: campaigns } = useSuspenseQuery(campaignsQuery());
  const { data: cps } = useSuspenseQuery(campaignProductsQuery());
  const [q, setQ] = useState("");

  const featured = campaigns.find((c) => c.status === "open");
  const filtered = useMemo(
    () =>
      products.filter((p) =>
        q ? (p.title + p.description + p.category).toLowerCase().includes(q.toLowerCase()) : true,
      ),
    [products, q],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header onSearch={setQ} />
      <main className="flex-1 pb-6">
        {featured && (
          <section className="relative mx-3 mt-3 overflow-hidden rounded-2xl shadow-brand">
            <img
              src={featured.container_image ?? "/images/hero-container.jpg"}
              alt="Container maritime"
              className="h-44 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  <Ship className="h-3 w-3" /> Container en cours
                </span>
                <CountdownTimer endDate={featured.end_date} compact />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold leading-tight">{featured.title}</h1>
                <p className="mt-0.5 text-xs opacity-90">{featured.description}</p>
                <div className="mt-2">
                  <ProgressBar
                    current={featured.current_participants}
                    target={featured.target_quantity}
                  />
                </div>
                <Link
                  to="/groupage"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white underline-offset-2 hover:underline"
                >
                  Voir tous les groupages <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <div className="mx-3 mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gradient-brand p-3 text-primary-foreground shadow-brand">
            <TrendingUp className="mx-auto h-4 w-4" />
            <div className="mt-1 text-[10px] font-medium opacity-90">Économie</div>
            <div className="font-display text-sm font-bold">-60%</div>
          </div>
          <div className="rounded-xl bg-gradient-premium p-3 text-secondary-foreground shadow-premium">
            <Sparkles className="mx-auto h-4 w-4" />
            <div className="mt-1 text-[10px] font-medium opacity-90">MLM</div>
            <div className="font-display text-sm font-bold">3 niveaux</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 shadow-card">
            <Ship className="mx-auto h-4 w-4 text-secondary" />
            <div className="mt-1 text-[10px] font-medium text-muted-foreground">Livraison</div>
            <div className="font-display text-sm font-bold">45j</div>
          </div>
        </div>

        <section className="mt-5 px-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-base font-bold">Catalogue</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} produits</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                campaign={activeCampaignForProduct(cps, campaigns, p.id)}
              />
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
