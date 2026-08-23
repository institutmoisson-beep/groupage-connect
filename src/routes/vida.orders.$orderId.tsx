import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck, Timer } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_LABELS,
  VIDA_ORDER_STATUS_CLASSES,
  vidaCountdownLabel,
  vidaFormatOrderCode,
  vidaIsCancellable,
  vidaQrUrl,
  vidaVoucherPayload,
} from "@/lib/vida";
import { vidaCancelOrder } from "@/lib/vida.functions";

export const Route = createFileRoute("/vida/orders/$orderId")({
  head: () => ({
    meta: [{ title: "Suivi de commande ViDa" }, { name: "robots", content: "noindex" }],
  }),
  component: VidaOrderDetail,
});

const TIMELINE_STEPS = [
  { key: "pending_deposit", label: "Voucher généré" },
  { key: "funds_locked", label: "Fonds verrouillés en séquestre" },
  { key: "in_transit", label: "En livraison" },
  { key: "delivered", label: "Livré & payé" },
] as const;

function VidaOrderDetail() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const cancelOrder = useServerFn(vidaCancelOrder);
  const [, forceTick] = useState(0);

  const { data: order, isLoading } = useQuery({
    queryKey: ["vida-order", orderId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("*, vida_products(title, image_url)")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Rafraîchit le countdown chaque minute sans re-fetch réseau.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const cancel = useMutation({
    mutationFn: (reason: string) => cancelOrder({ data: { orderId, reason } }),
    onSuccess: () => {
      toast.success("Commande annulée.");
      qc.invalidateQueries({ queryKey: ["vida-order", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !order) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 text-sm text-muted-foreground">
          Chargement…
        </main>
        <BottomNav />
      </div>
    );
  }

  const isCancelled = order.status.startsWith("cancelled") || order.status === "refunded";
  const currentStepIdx = TIMELINE_STEPS.findIndex((s) => s.key === order.status);
  const cancellable = vidaIsCancellable(order.status, order.cancellation_deadline);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-black">{order.vida_products?.title}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${VIDA_ORDER_STATUS_CLASSES[order.status]}`}
          >
            {VIDA_ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Référence {vidaFormatOrderCode(order.order_code)}
        </p>
        <p className="mt-1 text-lg font-black text-primary">
          {formatXOF(Number(order.total_amount))}
        </p>

        {/* Timeline */}
        {!isCancelled && (
          <ol className="mt-5 space-y-3">
            {TIMELINE_STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                    i <= currentStepIdx
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs ${i <= currentStepIdx ? "font-bold" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Voucher QR — visible tant que le dépôt n'est pas verrouillé */}
        {order.status === "pending_deposit" && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-bold">Présentez ce voucher à l'agent Mobile Money</p>
            <img
              src={vidaQrUrl(vidaVoucherPayload(order.order_code, "deposit"))}
              alt="QR code voucher ViDa"
              className="mx-auto mt-2 h-44 w-44"
            />
            <p className="mt-2 font-mono text-lg font-black tracking-widest">
              {vidaFormatOrderCode(order.order_code)}
            </p>
          </div>
        )}

        {/* OTP secret — visible une fois les fonds verrouillés */}
        {(order.status === "funds_locked" || order.status === "in_transit") && (
          <div className="mt-5 rounded-2xl border border-secondary/40 bg-secondary/10 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-secondary">
              <Lock className="h-3.5 w-3.5" />
              <p className="text-xs font-bold">Code de confirmation de livraison</p>
            </div>
            <p className="mt-2 font-mono text-2xl font-black tracking-[0.3em]">
              {order.delivery_otp}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Communiquez ce code UNIQUEMENT au livreur, au moment de la remise du colis.
            </p>
            {order.cancellation_deadline && (
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-bold text-destructive">
                <Timer className="h-3 w-3" /> {vidaCountdownLabel(order.cancellation_deadline)}
              </p>
            )}
          </div>
        )}

        {order.status === "cancelled_pending_refund" && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-bold">Remboursement en attente</p>
            <p className="mt-1 text-lg font-black text-primary">
              {formatXOF(Number(order.refund_amount))}
            </p>
            {order.agent_id && (
              <>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Présentez ce QR à l'agent pour récupérer votre remboursement en espèces.
                </p>
                <img
                  src={vidaQrUrl(vidaVoucherPayload(order.order_code, "refund"))}
                  alt="QR code remboursement ViDa"
                  className="mx-auto mt-2 h-40 w-40"
                />
              </>
            )}
          </div>
        )}

        {/* Bouton d'annulation dynamique */}
        <div className="mt-5">
          {cancellable ? (
            <button
              onClick={() => {
                const reason = window.prompt("Motif de l'annulation (facultatif) ?") ?? "";
                cancel.mutate(reason);
              }}
              disabled={cancel.isPending}
              className="w-full rounded-xl border border-destructive bg-destructive/10 py-3 text-sm font-black text-destructive disabled:opacity-50"
            >
              {cancel.isPending ? "Annulation…" : "Annuler la commande"}
            </button>
          ) : order.status === "funds_locked" || order.status === "in_transit" ? (
            <div className="flex items-center justify-center gap-1.5 rounded-xl bg-muted py-3 text-xs font-bold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Verrouillée en transit — annulation impossible
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Paiement Séquestre Garanti par ViDa
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
