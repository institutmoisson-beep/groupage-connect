import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_LABELS,
  VIDA_ORDER_STATUS_CLASSES,
  vidaFormatOrderCode,
  vidaIsCancellable,
} from "@/lib/vida";
import { vidaCancelOrder } from "@/lib/vida.functions";

export const Route = createFileRoute("/vida/orders")({
  head: () => ({ meta: [{ title: "Mes commandes ViDa" }, { name: "robots", content: "noindex" }] }),
  component: VidaOrders,
});

function VidaOrders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const cancelOrder = useServerFn(vidaCancelOrder);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["vida-my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("*, vida_products(title, image_url)")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: (v: { orderId: string; reason: string }) => cancelOrder({ data: v }),
    onSuccess: () => {
      toast.success("Commande annulée.");
      qc.invalidateQueries({ queryKey: ["vida-my-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <h1 className="font-display text-lg font-black">Mes commandes ViDa</h1>
        <ul className="mt-3 space-y-2">
          {isLoading && <li className="text-sm text-muted-foreground">Chargement…</li>}
          {(orders ?? []).map((o: any) => {
            const cancellable = vidaIsCancellable(o.status, o.cancellation_deadline);
            return (
              <li key={o.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Link
                    to="/vida/orders/$orderId"
                    params={{ orderId: o.id }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {o.vida_products?.image_url && (
                        <img
                          src={o.vida_products.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{o.vida_products?.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {vidaFormatOrderCode(o.order_code)}
                      </p>
                      <p className="text-xs font-black text-primary">
                        {formatXOF(Number(o.total_amount))}
                      </p>
                    </div>
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${VIDA_ORDER_STATUS_CLASSES[o.status] ?? "bg-muted"}`}
                  >
                    {VIDA_ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                {cancellable && (
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
            );
          })}
          {!isLoading && (orders ?? []).length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">
              Aucune commande ViDa pour l'instant.
            </li>
          )}
        </ul>
      </main>
      <BottomNav />
    </div>
  );
}
