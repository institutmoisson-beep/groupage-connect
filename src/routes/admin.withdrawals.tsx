import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { settleWithdrawal } from "@/lib/wallet.functions";
import { WITHDRAWAL_METHOD_LABELS, WITHDRAWAL_STATUS_LABELS } from "@/lib/stock";

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({
    meta: [
      { title: "Retraits portefeuille — Administration MSN" },
      { name: "description", content: "Validation et paiement des demandes de retrait des revendeurs et importateurs MSN." },
      { property: "og:title", content: "Retraits portefeuille — Administration MSN" },
      { property: "og:description", content: "Approbation, paiement et refus des retraits mobile money et bancaires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWithdrawals,
});

function AdminWithdrawals() {
  const qc = useQueryClient();
  const settle = useServerFn(settleWithdrawal);
  const [filter, setFilter] = useState<"pending" | "approved" | "paid" | "rejected" | "all">("pending");

  const { data: rows, isError, error } = useQuery({
    queryKey: ["admin-withdrawals", filter],
    queryFn: async () => {
      // withdrawal_requests.user_id référence auth.users, pas public.profiles : il n'y a
      // aucune FK que PostgREST puisse embarquer automatiquement. L'embed
      // "profiles:user_id(...)" échoue silencieusement (PGRST200) et vide la liste côté
      // admin. On récupère donc les deux tables séparément puis on les fusionne côté client
      // (même correctif que pour admin.roles.tsx).
      let q = supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data: withdrawals, error: wErr } = await q;
      if (wErr) throw wErr;

      const userIds = Array.from(new Set((withdrawals ?? []).map((w: any) => w.user_id)));
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);
      if (pErr) throw pErr;

      const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (withdrawals ?? []).map((w: any) => ({ ...w, profiles: profileById.get(w.user_id) ?? null }));
    },
  });

  useEffect(() => {
    if (isError) toast.error(`Erreur de chargement des retraits : ${(error as Error)?.message ?? "inconnue"}`);
  }, [isError, error]);

  const act = useMutation({
    mutationFn: (v: { withdrawalId: string; action: "approve" | "pay" | "reject"; note?: string }) =>
      settle({ data: v }),
    onSuccess: () => {
      toast.success("Retrait mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-black">Retraits portefeuille</h1>
        <p className="text-xs text-muted-foreground">
          Le débit du portefeuille est enregistré uniquement quand le retrait est marqué « Payé ».
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        {(["pending", "approved", "paid", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 ${filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
          >
            {f === "all" ? "Tous" : WITHDRAWAL_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {(rows ?? []).map((w: any) => (
          <li key={w.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black">{formatXOF(Number(w.amount_xof))}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                {WITHDRAWAL_STATUS_LABELS[w.status] ?? w.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {w.profiles?.full_name ?? "Utilisateur"} {w.profiles?.phone ? `· ${w.profiles.phone}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {WITHDRAWAL_METHOD_LABELS[w.method] ?? w.method} · {w.account_identifier}
              {w.account_holder ? ` · ${w.account_holder}` : ""}
            </p>
            {w.admin_notes && <p className="mt-1 text-[11px] text-destructive">{w.admin_notes}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
              <button
                onClick={() => act.mutate({ withdrawalId: w.id, action: "approve" })}
                className="rounded-lg bg-secondary px-3 py-1.5 text-secondary-foreground"
              >
                Approuver
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Confirmer le paiement et débiter le portefeuille ?"))
                    act.mutate({ withdrawalId: w.id, action: "pay" });
                }}
                className="rounded-lg bg-success px-3 py-1.5 text-success-foreground"
              >
                Marquer payé
              </button>
              <button
                onClick={() => {
                  const note = window.prompt("Motif du refus ?") ?? "";
                  act.mutate({ withdrawalId: w.id, action: "reject", note });
                }}
                className="rounded-lg bg-destructive px-3 py-1.5 text-destructive-foreground"
              >
                Refuser
              </button>
            </div>
          </li>
        ))}
        {rows?.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande.</p>}
      </ul>
    </div>
  );
}
