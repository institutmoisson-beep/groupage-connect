import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  ExternalLink,
  FileSignature,
  Fingerprint,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ProgressBar } from "@/components/ProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { uploadPaymentProof } from "@/lib/proof-upload";
import {
  OFS_CATEGORY_LABELS,
  ofsMandateText,
  ofsPayout,
  ofsProfit,
  ofsQrUrl,
  ofsReturnPercent,
  ofsTotalCost,
} from "@/lib/onfaisimple";

export const Route = createFileRoute("/onfaisimple/$productId")({
  head: () => ({
    meta: [
      { title: "Financer un lot — OnFaiSimple™ | MSN Courtier" },
      {
        name: "description",
        content:
          "Choisissez vos unités, signez votre mandat de vente commerciale et payez par portefeuille, Mobile Money ou USDT.",
      },
      { property: "og:title", content: "Financer un lot — OnFaiSimple™" },
      {
        property: "og:description",
        content: "Calculateur de profit, mandat légal signé par code PIN, paiement multi-canal.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnFaiSimpleDetail,
});

type Step = "config" | "mandate" | "payment";

function OnFaiSimpleDetail() {
  const { productId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("config");
  const [units, setUnits] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["ofs-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["ofs-channels"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_payment_channels")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: balance = 0 } = useQuery({
    queryKey: ["wallet-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("amount_xof")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.amount_xof), 0);
    },
  });

  const { data: hasPin, refetch: refetchPin } = useQuery({
    queryKey: ["ofs-pin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_signature_pins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["ofs-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const remaining = product ? Math.max(0, product.total_units - product.funded_units) : 0;
  const total = product ? ofsTotalCost(product, units) : 0;
  const profit = product ? ofsProfit(product, units) : 0;
  const payout = product ? ofsPayout(product, units) : 0;
  const channel = channels.find((c) => c.id === channelId) ?? null;

  const mandate = useMemo(
    () =>
      product
        ? ofsMandateText({
            reference: "à générer",
            fullName: profile?.full_name ?? user?.email ?? "Le Mandant",
            productTitle: product.title,
            units,
            total,
            payout,
            days: product.estimated_days,
            sharePercent: product.user_profit_share_percent,
          })
        : "",
    [product, profile, user, units, total, payout],
  );

  const setPinMutation = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.rpc("set_signature_pin", { p_pin: value });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewPin("");
      await refetchPin();
      toast.success("Code PIN de signature enregistré.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const method =
        channel?.kind === "wallet" ? "wallet" : (channel?.kind ?? "manual") + ":" + (channel?.name ?? "");
      const { data, error } = await supabase.rpc("onfaisimple_create_order", {
        p_product_id: productId,
        p_units: units,
        p_pin: pin,
        p_payment_method: channel?.kind === "wallet" ? "wallet" : method,
        p_channel_label: channel?.name ?? null,
        p_payment_reference: reference || null,
        p_payment_proof_url: proofUrl,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["ofs-product", productId] });
      qc.invalidateQueries({ queryKey: ["ofs-orders"] });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success(`Mandat ${row?.contract_reference ?? ""} enregistré !`);
      navigate({ to: "/onfaisimple/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onProofPick(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const up = await uploadPaymentProof(file, user.id);
      setProofUrl(up.url);
      toast.success("Preuve de paiement téléversée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copié !"),
      () => toast.error("Copie impossible"),
    );
  }

  const walletChannel = { id: "wallet", kind: "wallet" as const, name: "Portefeuille MSN" };
  const allChannels = [walletChannel, ...channels];

  const canPay =
    !!channel &&
    (channel.kind === "wallet"
      ? balance >= total
      : channel.kind === "crypto"
        ? reference.trim().length >= 8
        : channel.kind === "manual"
          ? !!proofUrl
          : true);

  if (isLoading || authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Ce lot n'existe plus.</p>
          <Link to="/onfaisimple" className="mt-3 inline-block text-xs font-semibold text-primary">
            ← Retour au catalogue
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const images = Array.isArray(product.images) ? (product.images as string[]) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-3 pb-8">
        <Link
          to="/onfaisimple"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> OnFaiSimple™
        </Link>

        <div className="mt-2 overflow-hidden rounded-2xl bg-card shadow-card">
          <div className="aspect-square bg-muted">
            <OptimizedImage
              src={images[0] ?? "/images/prod-drill.jpg"}
              alt={product.title}
              className="h-full w-full"
            />
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display text-base font-black leading-tight">{product.title}</h1>
              <span className="shrink-0 rounded-md bg-ofs-emerald/12 px-2 py-0.5 text-[11px] font-bold text-ofs-emerald">
                +{ofsReturnPercent(product)}% / {product.estimated_days} j
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {OFS_CATEGORY_LABELS[product.category] ?? product.category}
            </div>
            {product.description && (
              <p className="text-xs leading-relaxed text-muted-foreground">{product.description}</p>
            )}
            <ProgressBar current={product.funded_units} target={product.total_units} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-muted/50 p-2">
                <div className="text-[10px] text-muted-foreground">Coût sourcing / unité</div>
                <div className="font-bold text-ofs-navy">{formatXOF(product.unit_cost)}</div>
              </div>
              <div className="rounded-xl bg-muted/50 p-2">
                <div className="text-[10px] text-muted-foreground">Revente locale estimée</div>
                <div className="font-bold">{formatXOF(product.projected_retail_price)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Étape 1 — configuration */}
        <section className="mt-3 rounded-2xl bg-card p-3 shadow-card">
          <h2 className="font-display text-sm font-bold">1. Vos unités</h2>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setUnits((u) => Math.max(product.min_units_per_order, u - 1))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted/40"
              aria-label="Retirer une unité"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={units}
              min={product.min_units_per_order}
              max={remaining}
              onChange={(e) =>
                setUnits(
                  Math.max(
                    product.min_units_per_order,
                    Math.min(remaining || 1, Number(e.target.value) || 1),
                  ),
                )
              }
              className="w-20 rounded-xl border border-input bg-background py-2 text-center text-sm font-bold outline-none focus:border-primary"
            />
            <button
              onClick={() => setUnits((u) => Math.min(remaining || 1, u + 1))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted/40"
              aria-label="Ajouter une unité"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-[11px] text-muted-foreground">
              {remaining} unité(s) disponible(s)
            </span>
          </div>

          <div className="mt-3 space-y-1.5 rounded-xl bg-ofs-navy p-3 text-ofs-onnavy">
            <Row label="Coût total du financement" value={formatXOF(total)} />
            <Row label="Période de vente estimée" value={`${product.estimated_days} jours`} />
            <Row
              label={`Profit projeté (${product.user_profit_share_percent}% de marge)`}
              value={formatXOF(profit)}
              accent
            />
            <div className="my-1.5 h-px bg-white/15" />
            <Row label="Versement total attendu" value={formatXOF(payout)} strong />
          </div>

          {!user ? (
            <Link
              to="/auth"
              search={{ redirect: `/onfaisimple/${productId}` } as never}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ofs-gold py-3 text-sm font-bold text-ofs-navy"
            >
              <Lock className="h-4 w-4" /> Connectez-vous pour financer
            </Link>
          ) : product.status !== "funding" || remaining === 0 ? (
            <div className="mt-3 rounded-xl bg-muted p-3 text-center text-xs font-semibold text-muted-foreground">
              Ce lot est complet. Suivez le catalogue pour la prochaine ouverture.
            </div>
          ) : (
            <button
              onClick={() => setStep("mandate")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ofs-gold py-3 text-sm font-bold text-ofs-navy transition-transform active:scale-[0.99]"
            >
              <FileSignature className="h-4 w-4" /> Générer mon mandat
            </button>
          )}
        </section>

        {/* Étape 2 — mandat */}
        {user && step !== "config" && (
          <section className="mt-3 rounded-2xl bg-card p-3 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-ofs-emerald" /> 2. Contrat de mandat de vente
            </h2>
            <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-[10.5px] leading-relaxed text-muted-foreground">
              {mandate}
            </pre>
            <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--ofs-emerald)]"
              />
              J'ai lu et j'accepte le contrat de mandat de vente commerciale ci-dessus.
            </label>

            {!hasPin ? (
              <div className="mt-3 rounded-xl border border-dashed border-border p-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Fingerprint className="h-4 w-4 text-ofs-gold" /> Créez votre code de signature
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Un code à 4 chiffres, chiffré, qui signera tous vos mandats.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-24 rounded-xl border border-input bg-background py-2 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-primary"
                  />
                  <button
                    disabled={newPin.length !== 4 || setPinMutation.isPending}
                    onClick={() => setPinMutation.mutate(newPin)}
                    className="flex-1 rounded-xl bg-ofs-navy text-xs font-bold text-ofs-onnavy disabled:opacity-50"
                  >
                    Enregistrer le code
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Fingerprint className="h-4 w-4 text-ofs-gold" /> Signez avec votre code PIN
                </div>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="mt-2 w-28 rounded-xl border border-input bg-background py-2 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-primary"
                />
              </div>
            )}

            <button
              disabled={!accepted || pin.length !== 4}
              onClick={() => setStep("payment")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ofs-emerald py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <BadgeCheck className="h-4 w-4" /> Signer et choisir le paiement
            </button>
          </section>
        )}

        {/* Étape 3 — paiement */}
        {user && step === "payment" && (
          <section className="mt-3 rounded-2xl bg-card p-3 shadow-card">
            <h2 className="font-display text-sm font-bold">3. Paiement — {formatXOF(total)}</h2>

            <ul className="mt-2 space-y-2">
              {allChannels.map((c) => {
                const selected = channelId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setChannelId(c.id);
                        setReference("");
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-ofs-gold bg-ofs-gold/10"
                          : "border-border bg-muted/30 hover:bg-muted/60"
                      }`}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ofs-navy text-ofs-onnavy">
                        {c.kind === "wallet" ? (
                          <Wallet className="h-4 w-4" />
                        ) : c.kind === "crypto" ? (
                          <span className="text-[10px] font-black">₮</span>
                        ) : c.kind === "redirect" ? (
                          <ExternalLink className="h-4 w-4" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold">{c.name}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {c.kind === "wallet"
                            ? `Solde : ${formatXOF(balance)}`
                            : c.kind === "crypto"
                              ? `USDT ${"crypto_network" in c ? c.crypto_network : ""}`
                              : c.kind === "redirect"
                                ? "Paiement direct dans l'application"
                                : "Transfert manuel + capture"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {channel && channel.kind === "wallet" && balance < total && (
              <div className="mt-2 rounded-xl bg-destructive/10 p-3 text-[11px] font-semibold text-destructive">
                Solde insuffisant. Il manque {formatXOF(total - balance)}.
              </div>
            )}

            {channel && "redirect_url" in channel && channel.kind === "redirect" && (
              <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{channel.instructions}</p>
                {channel.redirect_url && (
                  <a
                    href={channel.redirect_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-ofs-navy py-2.5 text-xs font-bold text-ofs-onnavy"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir {channel.name}
                  </a>
                )}
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Référence de la transaction (optionnel)"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>
            )}

            {channel && channel.kind === "manual" && "account_identifier" in channel && (
              <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{channel.instructions}</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-muted-foreground">
                      {channel.account_holder}
                    </div>
                    <div className="truncate text-sm font-black">{channel.account_identifier}</div>
                  </div>
                  <button
                    onClick={() => copy(channel.account_identifier ?? "")}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-muted"
                    aria-label="Copier le numéro"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Référence / ID du transfert"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-2.5 text-xs font-semibold">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {proofUrl ? "Capture ajoutée ✓ (remplacer)" : "Téléverser la capture du reçu"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onProofPick(f);
                    }}
                  />
                </label>
              </div>
            )}

            {channel && channel.kind === "crypto" && "account_identifier" in channel && (
              <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{channel.instructions}</p>
                <div className="grid place-items-center rounded-xl bg-background p-3">
                  <img
                    src={ofsQrUrl(channel.account_identifier ?? "")}
                    alt={`QR code ${channel.name}`}
                    width={180}
                    height={180}
                    loading="lazy"
                    className="rounded-lg"
                  />
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Réseau {channel.crypto_network}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <code className="min-w-0 flex-1 truncate text-[11px]">
                    {channel.account_identifier}
                  </code>
                  <button
                    onClick={() => copy(channel.account_identifier ?? "")}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-muted"
                    aria-label="Copier l'adresse"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-xl bg-background px-3 py-2 text-[11px]">
                  Montant à envoyer :{" "}
                  <strong>≈ {(total * 0.00165).toFixed(2)} USDT</strong>{" "}
                  <span className="text-muted-foreground">(1 USDT ≈ 606 FCFA)</span>
                </div>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Hash de transaction (TxID)"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>
            )}

            <button
              disabled={!canPay || createOrder.isPending}
              onClick={() => createOrder.mutate()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ofs-gold py-3 text-sm font-black text-ofs-navy disabled:opacity-50"
            >
              {createOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              Valider mon mandat · {formatXOF(total)}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Paiement chiffré · mandat archivé · suivi en 7 étapes
            </p>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="opacity-80">{label}</span>
      <span
        className={`font-bold ${accent ? "text-ofs-emerald-light" : ""} ${strong ? "text-base font-black text-ofs-gold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
