import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/admin/commissions")({
  component: AdminCommissions,
});

function AdminCommissions() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*, referrer:profiles!commissions_referrer_id_fkey(full_name, referral_code), buyer:profiles!commissions_buyer_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const total = (rows ?? []).reduce((a, b: any) => a + Number(b.amount_xof ?? 0), 0);

  async function del(id: string) {
    if (!confirm("Supprimer cette commission ?")) return;
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimée");
      qc.invalidateQueries({ queryKey: ["admin-commissions"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black">Commissions MLM</h1>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Total distribué</div>
          <div className="font-display text-lg font-black text-primary">{formatXOF(total)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Parrain</th>
              <th className="p-2">Code</th>
              <th className="p-2">Acheteur</th>
              <th className="p-2">Niveau</th>
              <th className="p-2">Montant</th>
              <th className="p-2">Commande</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((c: any) => (
              <tr key={c.id} className="border-b border-border">
                <td className="p-2 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-CI")}</td>
                <td className="p-2">{c.referrer?.full_name ?? "—"}</td>
                <td className="p-2 font-mono text-[10px]">{c.referrer?.referral_code ?? "—"}</td>
                <td className="p-2">{c.buyer?.full_name ?? "—"}</td>
                <td className="p-2 text-center">L{c.level}</td>
                <td className="p-2 font-bold text-primary">{formatXOF(Number(c.amount_xof))}</td>
                <td className="p-2 font-mono text-[10px]">{c.order_id?.slice(0, 8)}</td>
                <td className="p-2 text-right">
                  <button onClick={() => del(c.id)} className="rounded bg-destructive p-1.5 text-destructive-foreground">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
