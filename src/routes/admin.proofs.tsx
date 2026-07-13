import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/admin/proofs")({
  component: AdminProofs,
});

function AdminProofs() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "verified" | "rejected" | "all">("pending");

  const { data: rows } = useQuery({
    queryKey: ["admin-proofs", filter],
    queryFn: async () => {
      let q = supabase
        .from("payment_proofs")
        .select("*, orders(id, total_xof, quantity, shipping_type, status), payment_methods(name, type)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function review(id: string, status: "verified" | "rejected", note?: string) {
    const { error } = await supabase
      .from("payment_proofs")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        review_note: note ?? null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "rejected") {
      // reset order to unpaid
      const row = (rows ?? []).find((r: any) => r.id === id);
      if (row?.order_id) {
        await supabase.from("orders").update({ payment_status: "unpaid" }).eq("id", row.order_id);
      }
    }
    toast.success(status === "verified" ? "Paiement validé" : "Preuve rejetée");
    qc.invalidateQueries({ queryKey: ["admin-proofs"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">Preuves de paiement</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["pending", "verified", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                filter === f ? "bg-card shadow-card" : "text-muted-foreground"
              }`}
            >
              {f === "pending"
                ? "En attente"
                : f === "verified"
                  ? "Validées"
                  : f === "rejected"
                    ? "Rejetées"
                    : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune preuve.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(rows ?? []).map((p: any) => (
            <li key={p.id} className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Référence</div>
                  <div className="font-mono text-sm font-bold">{p.reference}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.status === "verified"
                      ? "bg-success/15 text-success"
                      : p.status === "rejected"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-secondary/15 text-secondary"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Montant déclaré</div>
                  <div className="font-bold">{formatXOF(Number(p.amount_xof))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Moyen</div>
                  <div className="font-bold">{p.payment_methods?.name ?? "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Commande</div>
                  <div className="font-mono text-[11px]">{p.order_id?.slice(0, 8)}…</div>
                </div>
              </div>

              {p.note && (
                <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">{p.note}</div>
              )}

              {p.screenshot_url && (
                <a
                  href={p.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={p.screenshot_url}
                    alt="Preuve"
                    className="max-h-48 w-full object-contain bg-muted"
                  />
                  <div className="flex items-center justify-center gap-1 bg-card py-1 text-[10px] font-semibold text-muted-foreground">
                    <ExternalLink className="h-3 w-3" /> Ouvrir en grand
                  </div>
                </a>
              )}

              {p.status === "pending" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const note = prompt("Motif du rejet (optionnel)");
                      if (note !== null) review(p.id, "rejected", note || undefined);
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-destructive/10 py-2 text-xs font-semibold text-destructive"
                  >
                    <XCircle className="h-4 w-4" /> Rejeter
                  </button>
                  <button
                    onClick={() => review(p.id, "verified")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-gradient-brand py-2 text-xs font-bold text-primary-foreground shadow-brand"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Valider
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
