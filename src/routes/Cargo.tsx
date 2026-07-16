import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Warehouse,
  Copy,
  LogIn,
  Ship,
  Plane,
  PackagePlus,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Loader2,
  Truck,
  CheckCircle2,
} from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { distanceKm, computeDeliveryFeeXof, captureGpsPosition } from "@/lib/geo";

export const Route = createFileRoute("/cargo")({
  head: () => ({
    meta: [
      { title: "MSN Global Cargo — Forwarding Chine → Abidjan" },
      {
        name: "description",
        content:
          "Recevez vos achats Alibaba, 1688, Taobao et Dewu à notre entrepôt en Chine, suivez le contrôle qualité et l'expédition jusqu'à votre porte à Abidjan.",
      },
    ],
  }),
  component: CargoPage,
});

const MARKETPLACES = ["Alibaba", "1688", "Taobao", "Dewu", "Other"] as const;

const STATUS_STEPS: Array<{ key: string; label: string }> = [
  { key: "DECLARED", label: "Déclaré" },
  { key: "RECEIVED_CHINA", label: "Reçu en Chine" },
  { key: "IN_TRANSIT", label: "En transit" },
  { key: "CUSTOMS", label: "Douane locale" },
  { key: "READY_DELIVERY", label: "Prêt à livrer" },
  { key: "DISPATCHED", label: "En livraison" },
  { key: "DELIVERED", label: "Livré" },
];

function statusIndex(status: string) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function CargoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    source_platform: "Alibaba" as (typeof MARKETPLACES)[number],
    chinese_tracking_number: "",
    description: "",
    quantity: 1,
    declared_value: "",
    declared_value_currency: "CNY" as "CNY" | "USD",
    freight_type: "SEA" as "AIR" | "SEA",
  });
  const [submitting, setSubmitting] = useState(false);
  const [gpsBusy, setGpsBusy] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-cargo", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("referral_code, full_name, phone").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: cargoConfig } = useQuery({
    queryKey: ["cargo-config"],
    queryFn: async () => {
      const { data } = await supabase.from("cargo_config").select("*").eq("id", 1).maybeSingle();
      return data as any;
    },
  });

  const { data: myPackages } = useQuery({
    queryKey: ["my-forwarding-packages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forwarding_packages" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const clientCode = profile?.referral_code ? `MSN-${profile.referral_code}` : "MSN-…";

  function copyAddress() {
    const text = [
      cargoConfig?.china_warehouse_address,
      cargoConfig?.china_warehouse_contact ? `Contact: ${cargoConfig.china_warehouse_contact}` : "",
      `Code Client: ${clientCode}`,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Adresse copiée"),
      () => toast.error("Copie impossible, sélectionnez le texte manuellement"),
    );
  }

  async function declarePackage() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/cargo" } as never });
      return;
    }
    if (!form.chinese_tracking_number.trim() || !form.description.trim()) {
      toast.error("Numéro de suivi chinois et description requis");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("forwarding_packages" as any).insert({
        user_id: user.id,
        source_platform: form.source_platform,
        chinese_tracking_number: form.chinese_tracking_number.trim(),
        description: form.description.trim(),
        quantity: Math.max(1, Number(form.quantity)),
        declared_value: form.declared_value ? Number(form.declared_value) : null,
        declared_value_currency: form.declared_value_currency,
        freight_type: form.freight_type,
      } as never);
      if (error) throw error;
      toast.success("Colis déclaré. Vous serez notifié à sa réception en Chine.");
      qc.invalidateQueries({ queryKey: ["my-forwarding-packages"] });
      setForm({
        source_platform: "Alibaba",
        chinese_tracking_number: "",
        description: "",
        quantity: 1,
        declared_value: "",
        declared_value_currency: "CNY",
        freight_type: "SEA",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la déclaration");
    } finally {
      setSubmitting(false);
    }
  }

  async function approveQC(pkg: any) {
    const { error } = await supabase
      .from("forwarding_packages" as any)
      .update({ qc_approved_at: new Date().toISOString(), status: "IN_TRANSIT" } as never)
      .eq("id", pkg.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Qualité approuvée — expédition en cours");
      qc.invalidateQueries({ queryKey: ["my-forwarding-packages"] });
    }
  }

  async function rejectQC(pkg: any) {
    const note = prompt("Décrivez le problème constaté sur les photos QC :");
    if (note === null) return;
    const { error } = await supabase
      .from("forwarding_packages" as any)
      .update({ qc_rejected_at: new Date().toISOString(), qc_note: note || null, status: "CANCELLED" } as never)
      .eq("id", pkg.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Problème signalé — MSN va contacter le fournisseur");
      qc.invalidateQueries({ queryKey: ["my-forwarding-packages"] });
    }
  }

  async function activateGpsCheckout(pkg: any) {
    if (!cargoConfig?.local_hub_lat || !cargoConfig?.local_hub_lng) {
      toast.error("Le point de dispatch local n'est pas encore configuré par l'admin");
      return;
    }
    setGpsBusy(pkg.id);
    try {
      const pos = await captureGpsPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const dist = distanceKm(cargoConfig.local_hub_lat, cargoConfig.local_hub_lng, lat, lng);
      const deliveryFee = computeDeliveryFeeXof(dist, Number(cargoConfig.delivery_base_fee_xof), Number(cargoConfig.delivery_rate_per_km_xof));
      const total = Number(pkg.shipping_cost_xof || 0) + deliveryFee;
      const confirmed = confirm(
        `Position capturée (précision ~${Math.round(pos.coords.accuracy)}m).\n` +
          `Distance depuis le hub local : ${dist.toFixed(1)} km\n` +
          `Frais de livraison locale : ${formatXOF(deliveryFee)}\n` +
          `Fret international : ${formatXOF(Number(pkg.shipping_cost_xof || 0))}\n` +
          `Total à payer : ${formatXOF(total)}\n\n` +
          `Confirmer cette position comme destination de livraison ?`,
      );
      if (!confirmed) {
        setGpsBusy(null);
        return;
      }
      const { error: logError } = await supabase.from("package_delivery_logs" as any).insert({
        package_id: pkg.id,
        delivery_latitude: lat,
        delivery_longitude: lng,
        distance_km: dist,
        delivery_fee_xof: deliveryFee,
      } as never);
      if (logError) throw logError;
      const { error: pkgError } = await supabase
        .from("forwarding_packages" as any)
        .update({ status: "DISPATCHED" } as never)
        .eq("id", pkg.id);
      if (pkgError) throw pkgError;
      toast.success("Position verrouillée. La flotte locale va dispatcher votre colis.");
      qc.invalidateQueries({ queryKey: ["my-forwarding-packages"] });
    } catch (e: any) {
      toast.error(e?.message || "Impossible de capturer votre position GPS");
    } finally {
      setGpsBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-4">
        <div>
          <h1 className="font-display text-xl font-black">MSN Global Cargo</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Faites livrer vos achats Alibaba, 1688, Taobao ou Dewu à notre entrepôt en Chine. MSN contrôle la
            qualité, groupe et expédie jusqu'à votre porte à Abidjan.
          </p>
        </div>

        {/* A. My China Address */}
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary">
              <Warehouse className="h-3.5 w-3.5" /> Mon adresse entrepôt Chine
            </div>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-semibold shadow-card"
            >
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
            {cargoConfig?.china_warehouse_address || "Adresse en cours de configuration par MSN…"}
          </pre>
          {cargoConfig?.china_warehouse_contact && (
            <div className="mt-1 text-[11px] text-muted-foreground">Contact : {cargoConfig.china_warehouse_contact}</div>
          )}
          <div className="mt-2 rounded-lg bg-card px-2 py-1.5 font-mono text-xs font-bold text-primary">
            Code Client : {clientCode}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Collez cette adresse directement dans le champ "adresse de livraison" sur Alibaba, 1688 ou Taobao, et
            indiquez toujours votre Code Client sur le colis pour qu'il soit identifié à la réception.
          </p>
        </section>

        {/* B. Shipping Declaration Form */}
        <section className="space-y-3 rounded-xl bg-card p-3 shadow-card">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold">Déclarer un colis</h2>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Marketplace source</span>
            <select
              value={form.source_platform}
              onChange={(e) => setForm({ ...form, source_platform: e.target.value as any })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {MARKETPLACES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Numéro de suivi chinois (fourni par le vendeur)</span>
            <input
              value={form.chinese_tracking_number}
              onChange={(e) => setForm({ ...form, chinese_tracking_number: e.target.value })}
              placeholder="Ex : SF1234567890CN"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Description du colis</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Ex : 2 paires de chaussures, 1 sac à main"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Quantité estimée</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Valeur déclarée</span>
              <div className="mt-1 flex gap-1">
                <input
                  type="number"
                  value={form.declared_value}
                  onChange={(e) => setForm({ ...form, declared_value: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={form.declared_value_currency}
                  onChange={(e) => setForm({ ...form, declared_value_currency: e.target.value as any })}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                >
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">Type de fret souhaité</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => setForm({ ...form, freight_type: "AIR" })}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                  form.freight_type === "AIR"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <Plane className="h-4 w-4" />
                AIR CARGO EXPRESS
                <span className="text-[9px] font-normal">Rapide · facturé au kg</span>
              </button>
              <button
                onClick={() => setForm({ ...form, freight_type: "SEA" })}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition ${
                  form.freight_type === "SEA"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <Ship className="h-4 w-4" />
                SEA GROUPAGE
                <span className="text-[9px] font-normal">Économique · facturé au CBM</span>
              </button>
            </div>
          </div>

          {!user ? (
            <Link
              to="/auth"
              search={{ redirect: "/cargo" } as never}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand"
            >
              <LogIn className="h-4 w-4" /> Se connecter pour déclarer
            </Link>
          ) : (
            <button
              onClick={declarePackage}
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60"
            >
              {submitting ? "Envoi…" : "Déclarer ce colis à MSN"}
            </button>
          )}
        </section>

        {/* C. Live QC & Tracking */}
        {user && (myPackages ?? []).length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Mes colis ({myPackages!.length})
            </h2>
            <ul className="space-y-3">
              {myPackages!.map((pkg: any) => {
                const idx = statusIndex(pkg.status);
                const isCancelled = pkg.status === "CANCELLED";
                return (
                  <li key={pkg.id} className="space-y-3 rounded-xl bg-card p-3 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{pkg.description}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {pkg.source_platform} · Suivi {pkg.chinese_tracking_number} · qté {pkg.quantity}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                        {pkg.freight_type === "AIR" ? "Air Express" : "Sea Groupage"}
                      </span>
                    </div>

                    {/* Timeline */}
                    {!isCancelled ? (
                      <div className="flex items-center gap-0.5">
                        {STATUS_STEPS.map((step, i) => (
                          <div key={step.key} className="flex flex-1 items-center gap-0.5">
                            <div
                              className={`h-1.5 flex-1 rounded-full ${
                                i <= idx ? "bg-primary" : "bg-muted"
                              }`}
                              title={step.label}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive">
                        Annulé{pkg.qc_note ? ` — ${pkg.qc_note}` : ""}
                      </div>
                    )}
                    {!isCancelled && (
                      <div className="text-[10px] font-bold uppercase text-primary">
                        {STATUS_STEPS[idx]?.label}
                      </div>
                    )}

                    {pkg.shipping_cost_xof && (
                      <div className="flex justify-between rounded-lg bg-muted px-2 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">Fret international estimé</span>
                        <span className="font-bold">{formatXOF(Number(pkg.shipping_cost_xof))}</span>
                      </div>
                    )}

                    {/* QC block */}
                    {pkg.status === "RECEIVED_CHINA" && (pkg.qc_images_urls ?? []).length > 0 && !pkg.qc_approved_at && !pkg.qc_rejected_at && (
                      <div className="space-y-2 rounded-lg border border-secondary/40 bg-secondary/5 p-2">
                        <div className="text-[10px] font-bold uppercase text-secondary">
                          Contrôle qualité — {pkg.qc_images_urls.length} photo(s)
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {pkg.qc_images_urls.slice(0, 6).map((img: string, i: number) => (
                            <a key={i} href={img} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md">
                              <img src={img} alt={`QC ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => rejectQC(pkg)}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" /> Signaler un problème
                          </button>
                          <button
                            onClick={() => approveQC(pkg)}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-[11px] font-bold text-success"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Approuver & Expédier
                          </button>
                        </div>
                      </div>
                    )}

                    {/* D. GPS Autocapture Checkout */}
                    {pkg.status === "READY_DELIVERY" && (
                      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-primary">
                          <MapPin className="h-3.5 w-3.5" /> Livraison finale — activez votre position
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Votre colis est prêt. Activez votre position GPS pour verrouiller l'adresse de livraison et
                          voir les frais de livraison locale avant l'envoi de la flotte MSN.
                        </p>
                        <button
                          onClick={() => activateGpsCheckout(pkg)}
                          disabled={gpsBusy === pkg.id}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand disabled:opacity-60"
                        >
                          {gpsBusy === pkg.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Localisation…
                            </>
                          ) : (
                            <>
                              <MapPin className="h-3.5 w-3.5" /> Activer ma position & voir les frais
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {pkg.status === "DISPATCHED" && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-secondary/10 px-2 py-1.5 text-[11px] font-bold text-secondary">
                        <Truck className="h-3.5 w-3.5" /> Votre colis est en cours de livraison locale
                      </div>
                    )}
                    {pkg.status === "DELIVERED" && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-2 py-1.5 text-[11px] font-bold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Colis livré
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
