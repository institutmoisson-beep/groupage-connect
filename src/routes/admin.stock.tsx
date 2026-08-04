import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminGuard } from "@/components/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import {
  CATEGORY_LABELS,
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
} from "@/lib/stock";

export const Route = createFileRoute("/admin/stock")({
  head: () => ({
    meta: [
      { title: "Administration Stock Express — MSN Courtier" },
      { name: "description", content: "Validation des annonces de déstockage, affectation des livreurs et contrôle des encaissements COD." },
      { property: "og:title", content: "Administration Stock Express" },
      { property: "og:description", content: "Pilotage des annonces, livraisons et paiements cash à la livraison." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminStock />
    </AdminGuard>
  ),
});

function AdminStock() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"products" | "orders">("products");

  const { data: products } = useQuery({
    queryKey: ["admin-stock-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_express_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-stock-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_express_orders")
        .select("*, stock_express_products(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (v: { id: string; status: string; admin_notes?: string | null }) => {
      const { error } = await supabase
        .from("stock_express_products")
        .update({ status: v.status, admin_notes: v.admin_notes ?? null } as never)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Annonce mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-stock-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrder = useMutation({
    mutationFn: async (v: {
      id: string;
      status?: string;
      driver_name?: string;
      driver_contact?: string;
      delivery_fee_xof?: number;
    }) => {
      const patch: Record<string, unknown> = {};
      if (v.status) patch.status = v.status;
      if (v.driver_name !== undefined) patch.driver_name = v.driver_name || null;
      if (v.driver_contact !== undefined) patch.driver_contact = v.driver_contact || null;
      if (v.delivery_fee_xof !== undefined) patch.delivery_fee_xof = v.delivery_fee_xof;
      const { error } = await supabase.from("stock_express_orders").update(patch as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commande mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-stock-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-black">Stock Express</h1>
        <p className="text-xs text-muted-foreground">
          Validez les annonces des importateurs, affectez les livreurs et confirmez les encaissements cash.
        </p>
      </div>

      <div className="flex gap-2 text-xs font-bold">
        {(["products", "orders"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 ${tab === k ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
          >
            {k === "products" ? "Annonces" : "Commandes COD"}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <ul className="space-y-2">
          {(products ?? []).map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold">{p.title}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                  {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {CATEGORY_LABELS[p.category] ?? p.category} · Grossiste {formatXOF(Number(p.wholesale_price))} ·
                Commission {formatXOF(Number(p.commission_amount))} · {p.stock_quantity} en stock
                {p.container_tracking_number ? ` · Conteneur ${p.container_tracking_number}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                <button
                  onClick={() => updateProduct.mutate({ id: p.id, status: "active" })}
                  className="rounded-lg bg-success px-3 py-1.5 text-success-foreground"
                >
                  Valider
                </button>
                <button
                  onClick={() => updateProduct.mutate({ id: p.id, status: "hidden" })}
                  className="rounded-lg border border-border px-3 py-1.5"
                >
                  Masquer
                </button>
                <button
                  onClick={() => {
                    const note = window.prompt("Motif du refus ?") ?? "";
                    updateProduct.mutate({ id: p.id, status: "rejected", admin_notes: note });
                  }}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-destructive-foreground"
                >
                  Refuser
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {(orders ?? []).map((o: any) => (
            <li key={o.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold">{o.stock_express_products?.title ?? "Produit"}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS_CLASSES[o.status] ?? ""}`}>
                  {ORDER_STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {o.client_name} · {o.client_phone}
                {o.client_phone_alt ? ` / ${o.client_phone_alt}` : ""} · {o.city_district}
              </p>
              <p className="text-[11px] text-muted-foreground">{o.delivery_address}</p>
              <p className="mt-1 text-[11px]">
                Vente {formatXOF(Number(o.final_price))} · Grossiste {formatXOF(Number(o.wholesale_total))} ·
                Commission {formatXOF(Number(o.commission_earned))} · x{o.quantity}
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  defaultValue={o.driver_name ?? ""}
                  placeholder="Nom du livreur"
                  maxLength={120}
                  onBlur={(e) => {
                    if (e.target.value !== (o.driver_name ?? ""))
                      updateOrder.mutate({ id: o.id, driver_name: e.target.value });
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
                <input
                  defaultValue={o.driver_contact ?? ""}
                  placeholder="Contact livreur"
                  maxLength={40}
                  onBlur={(e) => {
                    if (e.target.value !== (o.driver_contact ?? ""))
                      updateOrder.mutate({ id: o.id, driver_contact: e.target.value });
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  defaultValue={Number(o.delivery_fee_xof ?? 0)}
                  placeholder="Frais de livraison"
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val) && val !== Number(o.delivery_fee_xof ?? 0))
                      updateOrder.mutate({ id: o.id, delivery_fee_xof: val });
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                <button
                  onClick={() => updateOrder.mutate({ id: o.id, status: "dispatched" })}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-secondary-foreground"
                >
                  En livraison
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Confirmer l'encaissement cash et créditer les portefeuilles ?"))
                      updateOrder.mutate({ id: o.id, status: "delivered" });
                  }}
                  className="rounded-lg bg-success px-3 py-1.5 text-success-foreground"
                >
                  Livré & payé
                </button>
                <button
                  onClick={() => updateOrder.mutate({ id: o.id, status: "cancelled" })}
                  className="rounded-lg border border-border px-3 py-1.5"
                >
                  Annuler
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
