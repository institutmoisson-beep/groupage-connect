import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PackageCheck, Phone, Truck } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { playNotificationSound } from "@/lib/notification-sound";
import { ORDER_STATUS_CLASSES, ORDER_STATUS_LABELS, whatsappLink } from "@/lib/stock";

export const Route = createFileRoute("/stock/orders")({
  head: () => ({
    meta: [
      { title: "Mes commandes Stock Express — MSN Courtier" },
      {
        name: "description",
        content: "Suivez vos commandes clients : attente, livraison en cours, livré & payé, et commissions créditées.",
      },
      { property: "og:title", content: "Mes commandes Stock Express" },
      { property: "og:description", content: "Suivi des livraisons et des commissions de revente MSN Stock Express." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StockOrders;
});

function StockOrders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"reseller" | "importer">("reseller");
  const deliveredSeen = useRef<Set<string> | null>(null);

  const { data: orders } = useQuery({
    queryKey: ["stock-orders", user?.id, tab],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const base = supabase
        .from("stock_express_orders")
        .select("*, stock_express_products(title, images, importer_id)")
        .order("created_at", { ascending: false });
      const { data, error } =
        tab === "reseller" ? await base.eq("reseller_id", user!.id) : await base;
      if (error) throw error;
      const rows = data ?? [];
      return tab === "importer"
        ? rows.filter((o: any) => o.stock_express_products?.importer_id === user!.id)
        : rows;
    },
  });

  // Alerte + son quand une commande passe à « Livré & Payé ».
  useEffect(() => {
    if (!orders) return;
    const delivered = new Set(
      orders.filter((o: any) => o.status === "delivered").map((o: any) => o.id as string),
    );
    if (deliveredSeen.current === null) {
      deliveredSeen.current = delivered;
      return;
    }
    for (const id of delivered) {
      if (!deliveredSeen.current.has(id)) {
        const order: any = orders.find((o: any) => o.id === id);
        playNotificationSound();
        toast.success(
          `Livré & payé ✅ — commission ${formatXOF(Number(order?.commission_earned ?? 0))} créditée`,
        );
      }
    }
    deliveredSeen.current = delivered;
  }, [orders]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <h1 className="font-display text-lg font-black">Commandes Stock Express</h1>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setTab("reseller")}
            className={`rounded-lg py-2 ${tab === "reseller" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
          >
            Mes reventes
          </button>
          <button
            onClick={() => setTab("importer")}
            className={`rounded-lg py-2 ${tab === "importer" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
          >
            Mon stock vendu
          </button>
        </div>

        {!user ? (
          <Link to="/auth" className="mt-4 inline-block text-sm text-primary underline">
            Se connecter
          </Link>
        ) : !orders?.length ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aucune commande pour le moment.{" "}
            <Link to="/stock" className="text-primary underline">
              Explorer le catalogue
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o: any) => (
              <li key={o.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{o.stock_express_products?.title ?? "Produit"}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS_CLASSES[o.status] ?? ""}`}
                  >
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {o.client_name} · {o.city_district} · x{o.quantity}
                </p>
                <p className="text-[11px] text-muted-foreground">{o.delivery_address}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">Vente {formatXOF(Number(o.final_price))}</span>
                  <span className="font-black text-success">
                    {tab === "reseller"
                      ? `Commission ${formatXOF(Number(o.commission_earned))}`
                      : `Part grossiste ${formatXOF(Number(o.wholesale_total))}`}
                  </span>
                </div>
                {o.driver_name && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Truck className="h-3 w-3" /> Livreur : {o.driver_name}
                    {o.driver_contact ? ` · ${o.driver_contact}` : ""}
                  </p>
                )}
                <div className="mt-2 flex gap-2 text-[11px] font-bold">
                  <a
                    href={`tel:${o.client_phone}`}
                    className="flex-1 rounded-lg border border-border py-2 text-center"
                  >
                    <Phone className="mr-1 inline h-3.5 w-3.5" /> Appeler
                  </a>
                  <a
                    href={whatsappLink(
                      o.client_phone,
                      `Bonjour ${o.client_name}, votre commande "${o.stock_express_products?.title ?? ""}" est ${
                        ORDER_STATUS_LABELS[o.status]?.toLowerCase() ?? "en traitement"
                      }.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-lg bg-success py-2 text-center text-success-foreground"
                  >
                    WhatsApp client
                  </a>
                </div>
                {o.status === "delivered" && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-success">
                    <PackageCheck className="h-3.5 w-3.5" /> Fonds crédités au portefeuille
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/wallet"
          className="mt-5 block rounded-xl bg-gradient-brand py-3 text-center text-sm font-black text-primary-foreground shadow-brand"
        >
          Voir mon portefeuille
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
