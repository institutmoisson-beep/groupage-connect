import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_LABELS,
  VIDA_ORDER_STATUS_CLASSES,
  vidaFormatOrderCode,
} from "@/lib/vida";

export const Route = createFileRoute("/vida/orders")({
  head: () => ({ meta: [{ title: "Mes commandes ViDa" }, { name: "robots", content: "noindex" }] }),
  component: VidaOrders,
});

function VidaOrders() {
  const { user } = useAuth();

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <h1 className="font-display text-lg font-black">Mes commandes ViDa</h1>
        <ul className="mt-3 space-y-2">
          {isLoading && <li className="text-sm text-muted-foreground">Chargement…</li>}
          {(orders ?? []).map((o: any) => (
            <li key={o.id}>
              <Link
                to="/vida/orders/$orderId"
                params={{ orderId: o.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
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
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${VIDA_ORDER_STATUS_CLASSES[o.status] ?? "bg-muted"}`}
                >
                  {VIDA_ORDER_STATUS_LABELS[o.status] ?? o.status}
                </span>
              </Link>
            </li>
          ))}
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
