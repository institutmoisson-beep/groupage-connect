import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Users, TrendingUp, Award, Copy, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/mlm")({
  head: () => ({ meta: [{ title: "Mon réseau MLM — MSN Courtier" }] }),
  component: MLMPage,
});

function MLMPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: referrals } = useQuery({
    queryKey: ["referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, referral_code, created_at, city")
        .eq("referred_by", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: commissions } = useQuery({
    queryKey: ["commissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("referrer_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!user) return <SignedOut />;

  const totalCommissions = (commissions ?? []).reduce((s, c) => s + Number(c.amount_xof), 0);
  const level = profile?.mlm_level ?? 1;

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth?ref=${profile?.referral_code ?? ""}`
      : "";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header />
      <main className="flex-1 px-3 pb-6 pt-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">Mon Réseau</h1>
            <p className="text-sm text-muted-foreground">Système Moissonneur</p>
          </div>
          <div className="rounded-full bg-gradient-premium px-3 py-1 text-xs font-bold text-secondary-foreground shadow-premium">
            Niveau {level}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Filleuls"
            value={(referrals?.length ?? 0).toString()}
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Commissions"
            value={formatXOF(totalCommissions)}
            highlight
          />
          <Stat
            icon={<Award className="h-4 w-4" />}
            label="Ventes"
            value={(commissions?.length ?? 0).toString()}
          />
        </div>

        <div className="mt-4 rounded-2xl bg-gradient-brand p-4 text-primary-foreground shadow-brand">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Votre code parrain
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-display text-2xl font-black tracking-wider">
              {profile?.referral_code ?? "…"}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                toast.success("Lien copié");
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/30"
            >
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
          <div className="mt-2 text-[11px] opacity-80">
            Partagez pour gagner 10% / 5% / 2% sur 3 niveaux.
          </div>
        </div>

        <section className="mt-6">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Mon réseau ({referrals?.length ?? 0})
          </h2>
          {(referrals?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun filleul pour l'instant. Partagez votre code pour développer votre réseau.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {referrals!.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-premium font-bold text-secondary-foreground">
                    {r.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{r.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.city} · {r.referral_code}
                    </div>
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                    Actif
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Commissions récentes
          </h2>
          {(commissions?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Aucune commission encore. Elles apparaîtront quand vos filleuls achètent.
            </div>
          ) : (
            <ul className="space-y-2">
              {commissions!.slice(0, 10).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-card p-3 shadow-card"
                >
                  <div>
                    <div className="text-sm font-semibold">Niveau {c.level}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("fr-CI")}
                    </div>
                  </div>
                  <span className="font-display text-base font-black text-primary">
                    +{formatXOF(Number(c.amount_xof))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 shadow-card ${highlight ? "bg-gradient-brand text-primary-foreground shadow-brand" : "bg-card"}`}
    >
      <div className={highlight ? "" : "text-secondary"}>{icon}</div>
      <div className="mt-1 text-[10px] font-medium opacity-80">{label}</div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-premium text-secondary-foreground shadow-premium">
          <Users className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-bold">Rejoignez le réseau MLM</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous pour voir votre code parrain, vos filleuls et vos commissions.
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
