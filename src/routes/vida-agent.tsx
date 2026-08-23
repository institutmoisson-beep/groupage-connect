import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, QrCode, RefreshCcw, ShieldAlert, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useVidaRole } from "@/hooks/use-vida-role";
import { formatXOF } from "@/lib/format";
import {
  VIDA_RECOVERY_MODE_HINTS,
  VIDA_RECOVERY_MODE_LABELS,
  vidaFormatOrderCode,
} from "@/lib/vida";
import {
  vidaAgentLockFunds,
  vidaAgentProcessRefund,
  vidaAgentSettleRecovery,
} from "@/lib/vida.functions";

export const Route = createFileRoute("/vida-agent")({
  head: () => ({
    meta: [{ title: "Terminal Agent Mobile Money — ViDa" }, { name: "robots", content: "noindex" }],
  }),
  component: VidaAgentPortal,
});

function VidaAgentPortal() {
  const { user, loading } = useAuth();
  const { hasRole, isPending, loading: roleLoading } = useVidaRole("agent");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const lockFunds = useServerFn(vidaAgentLockFunds);
  const processRefund = useServerFn(vidaAgentProcessRefund);
  const settleRecovery = useServerFn(vidaAgentSettleRecovery);

  const [voucherInput, setVoucherInput] = useState("");
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [recoveryRef, setRecoveryRef] = useState("");
  const [recoveryCounterparty, setRecoveryCounterparty] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/vida-agent" } as never });
  }, [loading, user, navigate]);

  const { data: cfg } = useQuery({
    queryKey: ["vida-agent-config", user?.id],
    enabled: !!user && hasRole,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_agent_configurations")
        .select("*")
        .eq("agent_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingRefunds } = useQuery({
    queryKey: ["vida-agent-refunds", user?.id],
    enabled: !!user && hasRole,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("id, order_code, refund_amount")
        .eq("agent_id", user!.id)
        .eq("status", "cancelled_pending_refund");
      if (error) throw error;
      return data;
    },
  });

  const lock = useMutation({
    mutationFn: () => lockFunds({ data: { orderCode: voucherInput.trim().toUpperCase() } }),
    onSuccess: (order: any) => {
      toast.success(`Fonds verrouillés pour ${vidaFormatOrderCode(order.order_code)}. OTP généré.`);
      setVoucherInput("");
      qc.invalidateQueries({ queryKey: ["vida-agent-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: (orderId: string) => processRefund({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Remboursement effectué.");
      qc.invalidateQueries({ queryKey: ["vida-agent-refunds"] });
      qc.invalidateQueries({ queryKey: ["vida-agent-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recover = useMutation({
    mutationFn: () =>
      settleRecovery({
        data: {
          amount: Number(recoveryAmount),
          referenceCode: recoveryRef.trim() || `REC-${Date.now()}`,
          counterpartyId: recoveryCounterparty.trim() || null,
          orderId: null,
        },
      }),
    onSuccess: () => {
      toast.success("Mouvement de récupération enregistré.");
      setRecoveryAmount("");
      setRecoveryRef("");
      setRecoveryCounterparty("");
      qc.invalidateQueries({ queryKey: ["vida-agent-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || roleLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!hasRole) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-bold">
          {isPending
            ? "Votre compte Agent est en attente de validation par l'administration."
            : "Accès réservé aux Agents Mobile Money approuvés."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <h1 className="font-display text-base font-black">Terminal Agent ViDa</h1>
        <p className="text-[10px] text-muted-foreground">
          Point Mobile Money — Escrow Deposit Scanner
        </p>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* Float & Cash Ledger */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <Banknote className="h-3 w-3" /> Cash en main
            </p>
            <p className="mt-1 text-lg font-black">{formatXOF(Number(cfg?.cash_in_hand ?? 0))}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <Wallet className="h-3 w-3" /> Float virtuel
            </p>
            <p className="mt-1 text-lg font-black">
              {formatXOF(Number(cfg?.virtual_float_balance ?? 0))}
            </p>
          </div>
        </section>

        {cfg && (
          <section className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold text-muted-foreground">
              Mode de récupération assigné
            </p>
            <p className="text-xs font-black">{VIDA_RECOVERY_MODE_LABELS[cfg.recovery_mode]}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {VIDA_RECOVERY_MODE_HINTS[cfg.recovery_mode]}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Plafond cash-in-hand : {formatXOF(Number(cfg.max_cash_limit))}
            </p>
          </section>
        )}

        {/* Escrow Deposit Scanner */}
        <section className="rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <QrCode className="h-4 w-4" /> Verrouiller un dépôt client
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Scannez le QR du client ou saisissez le code voucher à 8 caractères.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value)}
              placeholder="AB12CD34"
              className="flex-1 rounded-lg border border-input bg-background p-2.5 text-xs font-mono uppercase tracking-widest"
              maxLength={8}
            />
            <button
              onClick={() => lock.mutate()}
              disabled={lock.isPending || voucherInput.trim().length !== 8}
              className="rounded-lg bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-50"
            >
              {lock.isPending ? "…" : "Verrouiller"}
            </button>
          </div>
        </section>

        {/* Refund Processing */}
        {(pendingRefunds ?? []).length > 0 && (
          <section className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-bold">Remboursements en attente</p>
            <ul className="mt-2 space-y-2">
              {(pendingRefunds ?? []).map((o: any) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-[11px]"
                >
                  <span className="font-mono">{vidaFormatOrderCode(o.order_code)}</span>
                  <span className="font-black">{formatXOF(Number(o.refund_amount))}</span>
                  <button
                    onClick={() => refund.mutate(o.id)}
                    disabled={refund.isPending}
                    className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground"
                  >
                    Rembourser
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cash Recovery Engine */}
        <section className="rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <RefreshCcw className="h-4 w-4" /> Récupération de cash (
            {cfg ? VIDA_RECOVERY_MODE_LABELS[cfg.recovery_mode] : "…"})
          </p>
          <div className="mt-2 space-y-2">
            <input
              value={recoveryAmount}
              onChange={(e) => setRecoveryAmount(e.target.value)}
              type="number"
              placeholder="Montant (FCFA)"
              className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
            />
            {cfg?.recovery_mode === "AUTO_LOOP" && (
              <input
                value={recoveryCounterparty}
                onChange={(e) => setRecoveryCounterparty(e.target.value)}
                placeholder="ID vendeur/livreur payé cash"
                className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
              />
            )}
            <input
              value={recoveryRef}
              onChange={(e) => setRecoveryRef(e.target.value)}
              placeholder="Référence (tx MoMo / reçu collecte)"
              className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
            />
            <button
              onClick={() => recover.mutate()}
              disabled={recover.isPending || !recoveryAmount}
              className="w-full rounded-lg bg-secondary py-2.5 text-xs font-black text-secondary-foreground disabled:opacity-50"
            >
              {recover.isPending ? "…" : "Déclencher la récupération"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
