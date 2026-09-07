import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Truck } from "lucide-react";

import { formatXOF } from "@/lib/format";
import { VIDA_ORDER_STATUS_CLASSES, VIDA_ORDER_STATUS_LABELS, vidaFormatOrderCode } from "@/lib/vida";
import { vidaAssignCourier, vidaDeliveryBoard, vidaListCouriers } from "@/lib/vida.functions";

export const Route = createFileRoute("/admin/vida-delivery")({
  head: () => ({
    meta: [
      { title: "ViDa — Livraisons | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaDelivery,
});

function AdminVidaDelivery() {
  const qc = useQueryClient();
  const board = useServerFn(vidaDeliveryBoard);
  const couriers = useServerFn(vidaListCouriers);
  const assign = useServerFn(vidaAssignCourier);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-vida-delivery-board"],
    queryFn: () => board({ data: undefined }),
    refetchInterval: 30_000,
  });

  const { data: courierList } = useQuery({
    queryKey: ["admin-vida-couriers"],
    queryFn: () => couriers({ data: undefined }),
  });

  const assignMutation = useMutation({
    mutationFn: (v: { orderId: string; courierId: string }) => assign({ data: v }),
    onSuccess: () => {
      toast.success("Livraison confiée au livreur.");
      qc.invalidateQueries({ queryKey: ["admin-vida-delivery-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-black">
          <Truck className="h-5 w-5" /> ViDa — Livraisons
        </h1>
        <p className="text-sm text-muted-foreground">
          Confiez chaque commande à un livreur approuvé : il reçoit aussitôt la course dans son
          espace livreur avec l'adresse, le contact et la validation par code OTP.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement des commandes…</p>}

      <div className="space-y-3">
        {(orders ?? []).map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{o.product_title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {vidaFormatOrderCode(o.order_code)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  VIDA_ORDER_STATUS_CLASSES[o.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {VIDA_ORDER_STATUS_LABELS[o.status] ?? o.status}
              </span>
            </div>

            <div className="mt-2 grid gap-1 text-[12px] text-muted-foreground md:grid-cols-2">
              <p className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {o.delivery_address ?? "—"}
              </p>
              <p className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {o.delivery_phone ?? "—"}
              </p>
              <p>Montant séquestré : {formatXOF(Number(o.total_amount))}</p>
              <p>Frais de course : {formatXOF(Number(o.delivery_fee))}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Livreur actuel : {o.courier_name ?? "aucun"}
              </span>
              <select
                value={choice[o.id] ?? o.courier_id ?? ""}
                onChange={(e) => setChoice((s) => ({ ...s, [o.id]: e.target.value }))}
                className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Choisir un livreur…</option>
                {(courierList ?? []).map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.full_name ?? c.email ?? c.user_id} {c.phone ? `— ${c.phone}` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const courierId = choice[o.id] ?? o.courier_id ?? "";
                  if (!courierId) return toast.error("Sélectionnez un livreur.");
                  assignMutation.mutate({ orderId: o.id, courierId });
                }}
                disabled={assignMutation.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground disabled:opacity-50"
              >
                Confier la livraison
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (orders ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune commande à livrer pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
