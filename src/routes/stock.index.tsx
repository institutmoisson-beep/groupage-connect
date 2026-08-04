import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PackagePlus, Search, ShoppingBag, TrendingUp, Wallet } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { CATEGORY_LABELS, STOCK_CATEGORIES } from "@/lib/stock";

export const Route = createFileRoute("/stock/")({
  head: () => ({
    meta: [
      { title: "MSN Stock Express — Revendez du stock importé à Abidjan" },
      {
        name: "description",
        content:
          "Catalogue de déstockage B2B : choisissez un produit importé, vendez-le localement et gagnez une commission garantie par vente, payée à la livraison.",
      },
      { property: "og:title", content: "MSN Stock Express — Gagnez sur chaque vente" },
      {
        property: "og:description",
        content: "Produits importés au prix grossiste, commission garantie, livraison et encaissement assurés par MSN Cargo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StockCatalog,
});

type SortKey = "commission" | "recent" | "price";

function StockCatalog() {
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("commission");
  const [minCommission, setMinCommission] = useState(0);

  const { data: products, isLoading } = useQuery({
    queryKey: ["stock-catalog"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_express_products")
        .select("*")
        .eq("status", "active")
        .gt("stock_quantity", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(() => {
    let rows = products ?? [];
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((p) =>
        `${p.title} ${p.description ?? ""} ${p.category}`.toLowerCase().includes(needle),
      );
    }
    if (category !== "all") rows = rows.filter((p) => p.category === category);
    if (minCommission > 0) rows = rows.filter((p) => Number(p.commission_amount) >= minCommission);
    const sorted = [...rows];
    if (sort === "commission") sorted.sort((a, b) => Number(b.commission_amount) - Number(a.commission_amount));
    if (sort === "price") sorted.sort((a, b) => Number(a.suggested_price) - Number(b.suggested_price));
    return sorted;
  }, [products, q, category, minCommission, sort]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <section className="rounded-2xl bg-gradient-brand p-4 text-primary-foreground shadow-brand">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h1 className="font-display text-lg font-black">MSN Stock Express</h1>
          </div>
          <p className="mt-1 text-xs opacity-90">
            Vendez le stock déjà arrivé à Abidjan. Vous encaissez une commission garantie à chaque
            livraison payée — sans acheter de marchandise.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/stock/orders"
              className="flex-1 rounded-lg bg-background/15 px-3 py-2 text-center text-[11px] font-bold backdrop-blur"
            >
              Mes commandes
            </Link>
            <Link
              to="/wallet"
              className="flex-1 rounded-lg bg-background/15 px-3 py-2 text-center text-[11px] font-bold backdrop-blur"
            >
              <Wallet className="mr-1 inline h-3.5 w-3.5" /> Portefeuille
            </Link>
            <Link
              to="/stock/sell"
              className="flex-1 rounded-lg bg-background px-3 py-2 text-center text-[11px] font-bold text-primary"
            >
              <PackagePlus className="mr-1 inline h-3.5 w-3.5" /> Vendre
            </Link>
          </div>
        </section>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un produit…"
              maxLength={80}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 text-[11px]">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              Tout
            </Chip>
            {STOCK_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 font-semibold"
            >
              <option value="commission">Meilleure commission</option>
              <option value="recent">Nouveautés</option>
              <option value="price">Prix le plus bas</option>
            </select>
            <select
              value={minCommission}
              onChange={(e) => setMinCommission(Number(e.target.value))}
              className="rounded-lg border border-input bg-background px-2 py-1.5 font-semibold"
            >
              <option value={0}>Commission : toutes</option>
              <option value={1000}>≥ 1 000 FCFA</option>
              <option value={2000}>≥ 2 000 FCFA</option>
              <option value={5000}>≥ 5 000 FCFA</option>
              <option value={10000}>≥ 10 000 FCFA</option>
            </select>
          </div>
        </div>

        {!user && !loading ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 text-center text-sm">
            <p className="font-semibold">Connectez-vous pour accéder au catalogue</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand"
            >
              Se connecter
            </Link>
          </div>
        ) : isLoading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Chargement du catalogue…</p>
        ) : list.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aucun produit ne correspond. Revenez bientôt : de nouveaux conteneurs arrivent chaque semaine.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((p) => {
              const images = Array.isArray(p.images) ? (p.images as string[]) : [];
              return (
                <li key={p.id}>
                  <Link
                    to="/stock/$productId"
                    params={{ productId: p.id }}
                    className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]"
                  >
                    {images[0] ? (
                      <img
                        src={images[0]}
                        alt={p.title}
                        loading="lazy"
                        className="h-24 w-24 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[p.category] ?? p.category} · {p.stock_quantity} en stock
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Grossiste {formatXOF(Number(p.wholesale_price))} · Conseillé{" "}
                        <span className="font-semibold text-foreground">
                          {formatXOF(Number(p.suggested_price))}
                        </span>
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-black text-success">
                        <TrendingUp className="h-3 w-3" />
                        Gagnez {formatXOF(Number(p.commission_amount))} / vente
                      </p>
                    </div>
                  </Link>
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
