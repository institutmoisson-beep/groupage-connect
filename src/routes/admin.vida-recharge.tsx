import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, X } from "lucide-react";

import { formatXOF } from "@/lib/format";
import {
  vidaAdminListRechargeRequests,
  vidaAdminDecideRecharge,
  type VidaAdminRechargeRequest,
} from "@/lib/vida.functions";

export const Route = createFileRoute("/admin/vida-recharge")({
  head: () => ({
    meta: [
      { title: "ViDa — Ravitaillement des caisses | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaRecharge,
});

function AdminVidaRecharge() {
  const qc = useQueryClient();
  const listRequests = useServerFn(vidaAdminListRechargeRequests);
  const decide = useServerFn(vidaAdminDecideRecharge);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-vida-recharge-requests"],
    queryFn: () => listRequests({ data: undefined }),
  });

  const decideMutation = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean; note: string }) =>
      decide({ data: v }),
    onSuccess: (_row, vars) => {
      toast.success(
        vars.approve
          ? "Recharge approuvée — float agent crédité automatiquement."
          : "Demande refusée.",
      );
      qc.invalidateQueries({ queryKey: ["admin-vida-recharge-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const decided = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-black">
          <Banknote className="h-5 w-5" /> ViDa — Ravitaillement des caisses
        </h1>
        <p className="text-xs text-muted-foreground">
          Approuvez ou refusez les demandes de recharge du float virtuel des agents. Une
          approbation crédite automatiquement le montant demandé sur le compte de l'agent.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-black">
          En attente {pending.length > 0 && `(${pending.length})`}
        </h2>
        {isLoading && <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>}
        <ul className="mt-2 space-y-2">
          {pending.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              deciding={decideMutation.isPending}
              onDecide={(approve, note) =>
                decideMutation.mutate({ requestId: r.id, approve, note })
              }
            />
          ))}
          {!isLoading && pending.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Aucune demande en attente.
            </p>
          )}
        </ul>
      </div>

      {decided.length > 0 && (
        <div>
          <h2 className="text-sm font-black">Historique</h2>
          <ul className="mt-2 space-y-1.5">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 text-[11px]"
              >
                <div>
                  <p className="font-bold">{r.agent_full_name ?? r.agent_phone ?? r.agent_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatXOF(Number(r.amount_requested))}
                    {r.decision_note ? ` — ${r.decision_note}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    r.status === "approved"
                      ? "bg-success text-success-foreground"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {r.status === "approved" ? "Approuvée" : "Refusée"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
  deciding,
  onDecide,
}: {
  request: VidaAdminRechargeRequest;
  deciding: boolean;
  onDecide: (approve: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold">
            {request.agent_full_name ?? "(sans nom)"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {request.agent_phone ?? "—"} ·{" "}
            {new Date(request.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <p className="text-lg font-black text-primary">
          {formatXOF(Number(request.amount_requested))}
        </p>
      </div>
      {request.note && (
        <p className="mt-1.5 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          « {request.note} »
        </p>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note de décision (optionnel)"
        className="mt-2 w-full rounded-lg border border-input bg-background p-2 text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onDecide(true, note)}
          disabled={deciding}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-xs font-black text-success-foreground disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Approuver & créditer
        </button>
        <button
          onClick={() => onDecide(false, note)}
          disabled={deciding}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/10 py-2 text-xs font-black text-destructive disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Refuser
        </button>
      </div>
    </li>
  );
}
