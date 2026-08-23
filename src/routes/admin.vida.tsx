import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_LABELS,
  VIDA_ORDER_STATUS_CLASSES,
  vidaFormatOrderCode,
} from "@/lib/vida";

export const Route = createFileRoute("/admin/vida")({
  head: () => ({
    meta: [
      { title: "ViDa — Moteur Escrow | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaOverview,
});

function AdminVidaOverview() {
  const { data: orders } = useQuery({
    queryKey: ["admin-vida-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("*, vida_products(title)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const totals = (orders ?? []).reduce(
    (acc, o: any) => {
      if (o.status === "funds_locked" || o.status === "in_transit")
        acc.locked += Number(o.total_amount);
      if (o.status === "delivered") {
        acc.released += Number(o.total_amount);
        acc.platformCommission += Number(o.platform_commission);
        acc.agentCommission += Number(o.agent_commission);
      }
      return acc;
    },
    { locked: 0, released: 0, platformCommission: 0, agentCommission: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-black">ViDa — Moteur Escrow Global</h1>
          <p className="text-xs text-muted-foreground">
            Vue d'ensemble des fonds séquestrés et commissions.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          <Link
            to="/admin/vida-agents"
            className="rounded-lg border border-border bg-card px-3 py-1.5"
          >
            Agents & Rôles
          </Link>
          <Link
            to="/admin/vida-products"
            className="rounded-lg border border-border bg-card px-3 py-1.5"
          >
            Règles produits
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Fonds verrouillés" value={formatXOF(totals.locked)} />
        <Metric label="Fonds libérés" value={formatXOF(totals.released)} />
        <Metric label="Commissions agents" value={formatXOF(totals.agentCommission)} />
        <Metric label="Commission plateforme" value={formatXOF(totals.platformCommission)} />
      </div>

      <div>
        <h2 className="text-sm font-black">Dernières commandes ViDa</h2>
        <ul className="mt-2 space-y-2">
          {(orders ?? []).map((o: any) => (
            <li key={o.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">
                  {o.vida_products?.title} · {vidaFormatOrderCode(o.order_code)}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${VIDA_ORDER_STATUS_CLASSES[o.status]}`}
                >
                  {VIDA_ORDER_STATUS_LABELS[o.status]}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatXOF(Number(o.total_amount))}
              </p>
            </li>
          ))}
          {(orders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune commande ViDa.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
