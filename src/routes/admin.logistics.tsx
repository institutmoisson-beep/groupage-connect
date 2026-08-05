import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/admin/logistics")({
  head: () => ({
    meta: [
      { title: "Compte MSN Logistics — Administration" },
      {
        name: "description",
        content:
          "Suivi comptable des frais de livraison collectés sur les commandes Stock Express (compte MSN Logistics).",
      },
      { property: "og:title", content: "Compte MSN Logistics — Administration" },
      {
        property: "og:description",
        content: "Solde et historique des frais de livraison encaissés par MSN Logistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogistics,
});

const TYPE_LABELS: Record<string, string> = {
  delivery_fee: "Frais de livraison",
};

function AdminLogistics() {
  const [asc, setAsc] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["logistics-ledger", asc],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_ledger")
        .select("*, stock_express_orders(id, client_name, stock_express_products(title))")
        .order("created_at", { ascending: asc });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = useMemo(
    () => (rows ?? []).reduce((s: number, r: any) => s + Number(r.amount_xof ?? 0), 0),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-black">Compte MSN Logistics</h1>
        <p className="text-xs text-muted-foreground">
          Frais de livraison encaissés sur les commandes Stock Express livrées. Ce compte est séparé
          des portefeuilles utilisateurs.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-brand p-4 text-primary-foreground">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
          Solde total collecté
        </p>
        <p className="font-display text-2xl font-black">{formatXOF(total)}</p>
        <p className="mt-1 text-[11px] opacity-80">
          {(rows ?? []).length} écriture{(rows ?? []).length > 1 ? "s" : ""} comptable
          {(rows ?? []).length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Historique</h2>
        <button
          onClick={() => setAsc((v) => !v)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground"
        >
          Date {asc ? "↑ plus ancien" : "↓ plus récent"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (rows ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun frais de livraison enregistré.</p>
      ) : (
        <ul className="space-y-2">
          {(rows ?? []).map((r: any) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold">{r.label}</p>
                <p className="shrink-0 text-sm font-black text-success">
                  +{formatXOF(Number(r.amount_xof))}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {TYPE_LABELS[r.type] ?? r.type} ·{" "}
                {new Date(r.created_at).toLocaleString("fr-FR")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {r.stock_express_orders?.stock_express_products?.title
                  ? `Produit : ${r.stock_express_orders.stock_express_products.title} · `
                  : ""}
                {r.stock_order_id
                  ? `Commande #${String(r.stock_order_id).slice(0, 8).toUpperCase()}`
                  : "Commande supprimée"}
                {r.stock_express_orders?.client_name
                  ? ` · Client ${r.stock_express_orders.client_name}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
