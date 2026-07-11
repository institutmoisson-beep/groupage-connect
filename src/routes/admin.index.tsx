import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, Ship, ShoppingCart, Wallet, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, products, campaigns, orders, commissions, roles] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("groupage_campaigns").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total_xof, status, payment_status"),
        supabase.from("commissions").select("amount_xof"),
        supabase.from("user_roles").select("role"),
      ]);
      const orderRows = orders.data ?? [];
      const paid = orderRows.filter((o) => o.payment_status === "paid");
      const revenue = paid.reduce((a, b) => a + Number(b.total_xof ?? 0), 0);
      const commissionTotal = (commissions.data ?? []).reduce((a, b) => a + Number(b.amount_xof ?? 0), 0);
      return {
        users: users.count ?? 0,
        products: products.count ?? 0,
        campaigns: campaigns.count ?? 0,
        orders: orderRows.length,
        paidOrders: paid.length,
        revenue,
        commissionTotal,
        admins: (roles.data ?? []).filter((r) => r.role === "admin").length,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de MSN Courtier.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card icon={<Users className="h-5 w-5" />} label="Utilisateurs" value={String(stats?.users ?? "…")} />
        <Card icon={<Package className="h-5 w-5" />} label="Produits" value={String(stats?.products ?? "…")} />
        <Card icon={<Ship className="h-5 w-5" />} label="Campagnes" value={String(stats?.campaigns ?? "…")} />
        <Card
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Commandes"
          value={`${stats?.paidOrders ?? 0} / ${stats?.orders ?? 0}`}
          hint="payées / total"
        />
        <Card
          icon={<Wallet className="h-5 w-5" />}
          label="Revenus confirmés"
          value={stats ? formatXOF(stats.revenue) : "…"}
          wide
        />
        <Card
          icon={<Wallet className="h-5 w-5" />}
          label="Commissions distribuées"
          value={stats ? formatXOF(stats.commissionTotal) : "…"}
          wide
        />
        <Card icon={<ShieldCheck className="h-5 w-5" />} label="Administrateurs" value={String(stats?.admins ?? "…")} />
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-card p-4 shadow-card ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-xl font-black text-foreground">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
