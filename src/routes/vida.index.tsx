import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldCheck, Search, PackageCheck } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/vida/")({
  head: () => ({
    meta: [
      { title: "ViDa — Paiement Séquestre Garanti | MSN Courtier" },
      {
        name: "description",
        content:
          "Achetez en toute confiance : vos fonds restent sous séquestre jusqu'à la livraison vérifiée par OTP. Payez en ligne ou en espèces chez un agent Mobile Money partenaire.",
      },
      { property: "og:title", content: "ViDa — Paiement Séquestre Garanti" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VidaCatalog,
});

function VidaCatalog() {
  const [q, setQ] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["vida-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = products ?? [];
    if (!needle) return rows;
    return rows.filter((p: any) =>
      `${p.title} ${p.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [products, q]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onSearch={setQ} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <section className="rounded-2xl bg-gradient-brand p-4 text-primary-foreground shadow-brand">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="font-display text-lg font-black">ViDa</h1>
          </div>
          <p className="mt-1 text-xs opacity-90">
            Paiement Séquestre Garanti. Vos fonds sont bloqués jusqu'à la livraison — payez en ligne
            ou en espèces chez un Agent Mobile Money partenaire.
          </p>
          <Link
            to="/vida/orders"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-background/15 px-3 py-2 text-[11px] font-bold backdrop-blur"
          >
            <PackageCheck className="h-3.5 w-3.5" /> Mes commandes ViDa
          </Link>
        </section>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit ViDa…"
            className="w-full rounded-full border border-input bg-muted/50 py-2 pl-8 pr-3 text-xs outline-none focus:border-primary focus:bg-background"
          />
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          {list.map((p: any) => (
            <li key={p.id}>
              <Link
                to="/vida/$productId"
                params={{ productId: p.id }}
                className="block overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="aspect-square w-full bg-muted">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-bold">{p.title}</p>
                  <p className="mt-1 text-sm font-black text-primary">
                    {formatXOF(Number(p.price_xof))}
                  </p>
                  {Number(p.stock_quantity) > 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[9px] font-bold text-secondary">
                      <ShieldCheck className="h-2.5 w-2.5" /> Paiement Séquestre Garanti
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                      Rupture de stock
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {!isLoading && list.length === 0 && (
            <li className="col-span-2 py-10 text-center text-sm text-muted-foreground">
              Aucun produit disponible pour l'instant.
            </li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-bold text-muted-foreground">
          <Link to="/vida-agent" className="rounded-full border border-border px-3 py-1.5">
            Espace Agent Mobile Money
          </Link>
          <Link to="/vida-courier" className="rounded-full border border-border px-3 py-1.5">
            Espace Livreur
          </Link>
          <Link to="/vida-vendor" className="rounded-full border border-border px-3 py-1.5">
            Espace Vendeur
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
