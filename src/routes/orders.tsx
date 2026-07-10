import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Ship, Plane, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Mes commandes — MSN Courtier" }] }),
  component: OrdersPage,
});

const STATUS_LABEL: Record<string, { label: string; step: number; color: string }> = {
  pending: { label: "En attente paiement", step: 1, color: "bg-warning text-warning-foreground" },
  paid_confirmed: { label: "Payé — En préparation", step: 2, color: "bg-secondary text-secondary-foreground" },
  shipped: { label: "Expédié Chine", step: 3, color: "bg-secondary text-secondary-foreground" },
  transit: { label: "En transit", step: 4, color: "bg-secondary text-secondary-foreground" },
  abidjan: { label: "Arrivé Abidjan", step: 5, color: "bg-primary text-primary-foreground" },
  delivered: { label: "Livré", step: 6, color: "bg-success text-success-foreground" },
  cancelled: { label: "Annulé", step: 0, color: "bg-muted text-muted-foreground" },
};

function OrdersPage() {
  const { user, loading } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(title, image_urls)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background p-6 text-center">
        <Link to="/auth" className="mt-16 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-6 py-3 text-sm font-bold text-primary-foreground shadow-brand">
          <LogIn className="h-4 w-4" /> Connexion requise
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-base font-bold">Mes commandes</h1>
      </header>
      <main className="flex-1 space-y-3 px-3 py-4 pb-24">
        {(orders?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune commande. Parcourez le catalogue !
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand"
            >
              Voir les produits
            </Link>
          </div>
        ) : (
          orders!.map((o) => {
            const status = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            const p = (o as any).products;
            return (
              <article key={o.id} className="rounded-xl bg-card p-3 shadow-card">
                <div className="flex gap-3">
                  <img
                    src={p?.image_urls?.[0]}
                    alt={p?.title}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="line-clamp-2 text-sm font-semibold">{p?.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {o.shipping_type === "sea" ? (
                        <Ship className="h-3 w-3" />
                      ) : (
                        <Plane className="h-3 w-3" />
                      )}
                      Qté {o.quantity} · {new Date(o.created_at).toLocaleDateString("fr-CI")}
                    </div>
                    <div className="mt-1 font-display text-base font-black text-primary">
                      {formatXOF(Number(o.total_xof))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status.color}`}>
                    {status.label}
                  </span>
                  {status.step > 0 && (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((s) => (
                        <div
                          key={s}
                          className={`h-1.5 w-4 rounded-full ${s <= status.step ? "bg-primary" : "bg-muted"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>
      <BottomNav />
    </div>
  );
}
