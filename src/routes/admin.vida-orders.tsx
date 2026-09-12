import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Search, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_LABELS,
  VIDA_ORDER_STATUS_CLASSES,
  vidaFormatOrderCode,
} from "@/lib/vida";
import { vidaAdminCancelOrder } from "@/lib/vida.functions";

export const Route = createFileRoute("/admin/vida-orders")({
  head: () => ({
    meta: [
      { title: "ViDa — Commandes | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaOrders,
});

const STATUS_FILTERS = [
  "all",
  "pending_deposit",
  "funds_locked",
  "in_transit",
  "delivered",
  "cancelled_pending_refund",
  "refunded",
  "disputed",
] as const;

const CANCELLABLE_STATUSES = new Set(["pending_deposit", "funds_locked", "in_transit"]);

function AdminVidaOrders() {
  const qc = useQueryClient();
  const cancelOrder = useServerFn(vidaAdminCancelOrder);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-vida-orders-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("*, vida_products(title, image_url)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: (v: { orderId: string; reason: string }) => cancelOrder({ data: v }),
    onSuccess: () => {
      toast.success("Commande annulée par l'administration.");
      qc.invalidateQueries({ queryKey: ["admin-vida-orders-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = orders ?? [];
    if (statusFilter !== "all") rows = rows.filter((o: any) => o.status === statusFilter);
    if (needle) {
      rows = rows.filter((o: any) =>
        `${o.order_code} ${o.vida_products?.title ?? ""} ${o.delivery_phone ?? ""}`
          .toLowerCase()
          .includes(needle),
      );
    }
    return rows;
  }, [orders, q, statusFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-black">
          <ClipboardList className="h-5 w-5" /> ViDa — Suivi des commandes
        </h1>
        <p className="text-xs text-muted-foreground">
          Vue d'ensemble de toutes les commandes ViDa. L'annulation admin fonctionne quel que
          soit le statut (sauf déjà livrée/déjà remboursée), sans tenir compte de la fenêtre
          d'annulation client — remboursement intégral et automatique si des fonds étaient
          déjà séquestrés.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code voucher, produit, téléphone…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-input bg-background px-2 py-2 text-xs"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Tous les statuts" : VIDA_ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <ul className="space-y-2">
        {filtered.map((o: any) => (
          <li key={o.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {o.vida_products?.image_url && (
                  <img
                    src={o.vida_products.image_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{o.vida_products?.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {vidaFormatOrderCode(o.order_code)} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-primary">
                  {formatXOF(Number(o.total_amount))}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${VIDA_ORDER_STATUS_CLASSES[o.status] ?? "bg-muted"}`}
                >
                  {VIDA_ORDER_STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>
            </div>
            {o.delivery_phone && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Livraison : {o.delivery_address} · {o.delivery_phone}
              </p>
            )}
            {o.admin_cancel_reason && (
              <p className="mt-1 text-[10px] text-destructive">
                Annulée par l'admin — {o.admin_cancel_reason}
              </p>
            )}
            {CANCELLABLE_STATUSES.has(o.status) && (
              <button
                onClick={() => {
                  const reason = window.prompt("Motif de l'annulation (facultatif) ?") ?? "";
                  cancel.mutate({ orderId: o.id, reason });
                }}
                disabled={cancel.isPending}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/5 py-1.5 text-[10px] font-bold text-destructive disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Annuler cette commande
              </button>
            )}
          </li>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Aucune commande trouvée.
          </p>
        )}
      </ul>
    </div>
  );
}
