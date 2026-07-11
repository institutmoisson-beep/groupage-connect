import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, LogIn, Package, MapPin, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mon profil — MSN Courtier" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-xl font-bold">Créez votre compte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour gérer vos commandes et votre réseau.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-6 py-3 text-sm font-bold text-primary-foreground shadow-brand"
          >
            <LogIn className="h-4 w-4" /> Se connecter
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header />
      <main className="flex-1 px-3 pb-6 pt-3">
        <div className="rounded-2xl bg-gradient-brand p-5 text-primary-foreground shadow-brand">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20 font-display text-xl font-black backdrop-blur">
              {profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-display text-lg font-bold">{profile?.full_name ?? user.email}</div>
              <div className="text-xs opacity-90">Niveau {profile?.mlm_level ?? 1} · Membre</div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl bg-card p-4 shadow-card">
          <Row icon={<MapPin className="h-4 w-4 text-secondary" />} label="Ville" value={profile?.city ?? "—"} />
          <Row icon={<Phone className="h-4 w-4 text-secondary" />} label="Téléphone" value={profile?.phone ?? "—"} />
          <Row
            icon={<Package className="h-4 w-4 text-secondary" />}
            label="Code parrain"
            value={profile?.referral_code ?? "—"}
          />
        </div>

        <Link
          to="/orders"
          className="mt-3 flex items-center justify-between rounded-xl bg-card p-4 shadow-card hover:bg-muted"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Mes commandes</div>
              <div className="text-[11px] text-muted-foreground">Suivi & historique</div>
            </div>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Déconnecté");
            navigate({ to: "/" });
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </main>
      <BottomNav />
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
