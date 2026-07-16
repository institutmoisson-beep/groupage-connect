import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

const STATUSES = ["pending", "paid_confirmed", "shipped", "transit", "abidjan", "delivered", "cancelled"] as const;
const PAY_STATUSES = ["unpaid", "pending", "paid", "failed"] as const;

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");

  const { data: rows, isError, error } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, products(title), profiles!orders_user_profile_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter) q = q.eq("status", filter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(`Erreur de chargement des commandes : ${(error as any)?.message ?? "inconnue"}`);
    }
  }, [isError, error]);

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  }
  async function del(id: string) {
    if (!confirm("Supprimer cette commande ?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimée");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black">Commandes</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs">
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Client</th>
              <th className="p-2">Produit</th>
              <th className="p-2">Qté</th>
              <th className="p-2">Total</th>
              <th className="p-2">Livraison</th>
              <th className="p-2">Statut</th>
              <th className="p-2">Paiement</th>
              <th className="p-2">Réf.</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((o: any) => (
              <OrderRow key={o.id} row={o} onSave={save} onDelete={del} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderRow({ row, onSave, onDelete }: { row: any; onSave: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const [status, setStatus] = useState<string>(row.status);
  const [payment_status, setPay] = useState<string>(row.payment_status);
  return (
    <tr className="border-b border-border">
      <td className="p-2 text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString("fr-CI")}</td>
      <td className="p-2">{row.profiles?.full_name ?? "—"}</td>
      <td className="p-2">{row.products?.title ?? "—"}</td>
      <td className="p-2">{row.quantity}</td>
      <td className="p-2 font-bold text-primary">{formatXOF(Number(row.total_xof))}</td>
      <td className="p-2 uppercase">{row.shipping_type}</td>
      <td className="p-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-input bg-background px-1.5 py-1">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <select value={payment_status} onChange={(e) => setPay(e.target.value)} className="rounded border border-input bg-background px-1.5 py-1">
          {PAY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2 font-mono text-[10px]">{row.payment_reference ?? "—"}</td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => onSave(row.id, { status, payment_status })} className="rounded bg-primary p-1.5 text-primary-foreground">
            <Save className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(row.id)} className="rounded bg-destructive p-1.5 text-destructive-foreground">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
