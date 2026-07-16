import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Ship, Plane, MapPin } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProgressBar } from "@/components/ProgressBar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ShareButtons } from "@/components/ShareButtons";
import { campaignsQuery, campaignProductsQuery, productsQuery } from "@/lib/queries";
import { formatXOF, computePrice } from "@/lib/format";

export const Route = createFileRoute("/groupage")({
  head: () => ({
    meta: [
      { title: "Groupage & Achat Solidaire — MSN Courtier" },
      {
        name: "description",
        content:
          "Rejoignez un container maritime ou aérien en cours. Prix en gros, livraison groupée à Abidjan.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(campaignsQuery());
    context.queryClient.ensureQueryData(campaignProductsQuery());
    context.queryClient.ensureQueryData(productsQuery());
  },
  component: GroupagePage,
});

type Tab = "all" | "sea" | "air";

function GroupagePage() {
  const { data: campaigns } = useSuspenseQuery(campaignsQuery());
  const { data: cps } = useSuspenseQuery(campaignProductsQuery());
  const { data: products } = useSuspenseQuery(productsQuery());
  const [tab, setTab] = useState<Tab>("all");

  const filtered = campaigns.filter((c) => (tab === "all" ? true : c.shipping_type === tab));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header />
      <main className="flex-1 px-3 pb-6 pt-3">
        <div className="mb-4">
          <h1 className="font-display text-xl font-bold">Achat Solidaire</h1>
          <p className="text-sm text-muted-foreground">
            Groupez vos achats — payez au prix gros.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(
            [
              { k: "all", label: "Tout" },
              { k: "sea", label: "Maritime" },
              { k: "air", label: "Aérien" },
            ] as { k: Tab; label: string }[]
          ).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                tab === k
                  ? "bg-gradient-brand text-primary-foreground shadow-brand"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map((c) => {
            const linked = cps.filter((l) => l.campaign_id === c.id);
            const items = products.filter((p) => linked.some((l) => l.product_id === p.id));
            const almost = c.current_participants / c.target_quantity >= 0.8;
            return (
              <article
                key={c.id}
                id={c.id}
                className={`overflow-hidden rounded-2xl bg-card shadow-card ${almost ? "ring-2 ring-primary/60" : ""}`}
              >
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={c.container_image ?? "/images/hero-container.jpg"}
                    alt={c.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-secondary-foreground">
                      {c.shipping_type === "sea" ? (
                        <Ship className="h-3 w-3" />
                      ) : (
                        <Plane className="h-3 w-3" />
                      )}
                      {c.shipping_type === "sea" ? "Maritime" : "Aérien"}
                    </span>
                    {c.status !== "open" && (
                      <span className="rounded-full bg-warning px-2 py-1 text-[10px] font-bold uppercase text-warning-foreground">
                        {c.status}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-display text-base font-bold leading-tight">{c.title}</h3>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] opacity-90">
                      <MapPin className="h-3 w-3" /> Guangzhou → Abidjan · ETA {c.eta_days}j
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <ProgressBar current={c.current_participants} target={c.target_quantity} />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Ferme dans
                    </span>
                    <CountdownTimer endDate={c.end_date} />
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Inviter des amis
                    </span>
                    <ShareButtons
                      compact
                      url={typeof window !== "undefined" ? `${window.location.origin}/groupage#${c.id}` : `/groupage#${c.id}`}
                      title={c.title}
                      text={`Rejoignez le groupage "${c.title}" sur MSN Courtier — encore ${Math.max(0, c.target_quantity - c.current_participants)} places, ferme bientôt ! 🚢`}
                    />
                  </div>

                  {items.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {items.slice(0, 6).map((p) => (
                        <Link
                          key={p.id}
                          to="/product/$id"
                          params={{ id: p.id }}
                          className="w-24 shrink-0"
                        >
                          <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                            <img
                              src={p.image_urls[0]}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="mt-1 line-clamp-1 text-[10px] font-medium">{p.title}</div>
                          <div className="text-[11px] font-bold text-primary">
                            {formatXOF(computePrice(p))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
