import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Package,
  Ship,
  Link as LinkIcon,
  ShoppingCart,
  Wallet,
  Home,
  LogOut,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration — MSN Courtier" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Tableau de bord", icon: Home, exact: true },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/roles", label: "Rôles", icon: ShieldCheck },
  { to: "/admin/products", label: "Produits", icon: Package },
  { to: "/admin/campaigns", label: "Campagnes", icon: Ship },
  { to: "/admin/campaign-products", label: "Produits/Campagnes", icon: LinkIcon },
  { to: "/admin/orders", label: "Commandes", icon: ShoppingCart },
  { to: "/admin/commissions", label: "Commissions", icon: Wallet },
] as const;

function AdminLayout() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: pathname } as never });
    else if (!isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, roleLoading, navigate, pathname]);

  if (loading || roleLoading || !user || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Vérification des accès…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-sm font-black">MSN Admin</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gestion complète</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary">
              ← Application
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-xs">
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: !!exact }}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "bg-muted/40 text-muted-foreground hover:bg-muted" }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
