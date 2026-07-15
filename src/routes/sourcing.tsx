import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Ship, Plane, LogIn, Package, Sparkles, Loader2, CreditCard, Warehouse, ShieldCheck } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { scrapeProductPage } from "@/lib/sourcing.functions";

export const Route = createFileRoute("/sourcing")({
  head: () => ({
    meta: [
      { title: "Sourcing MSN — Achat proxy 1688 / Taobao" },
      {
        name: "description",
        content:
          "Collez un lien 1688, Taobao ou AliExpress : MSN Courtier scanne le produit, calcule le prix en FCFA et achète pour vous.",
      },
    ],
  }),
  component: SourcingPage,
});

const STATUS_LABEL: Record<string, string> = {
  quote_pending: "Devis en cours",
  quoted: "Devis prêt",
  paid: "Payé",
  ordered_china: "Commandé en Chine",
  qc: "Contrôle qualité",
  shipped: "Expédié",
  transit: "En transit",
  abidjan: "Arrivé Abidjan",
  delivered: "Livré",
  cancelled: "Annulé",
};

const EXCHANGE_RATE = 85;
const COMMISSION_RATE = 0.07;

type ScanResult = Awaited<ReturnType<typeof scrapeProductPage>>;
type Variant = { label: string; price_cny?: number; image?: string };

function SourcingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scanFn = useServerFn(scrapeProductPage);

  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScanResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [manual, setManual] = useState({
    product_name: "",
    cny_unit_price: "",
    quantity: 1,
    shipping_type: "sea" as "sea" | "air",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const activePriceCny = useMemo(() => {
    if (selectedVariant?.price_cny) return selectedVariant.price_cny;
    if (scanned?.price_cny) return scanned.price_cny;
    return Number(manual.cny_unit_price) || 0;
  }, [selectedVariant, scanned, manual.cny_unit_price]);

  const preview = useMemo(() => {
    const productCost = activePriceCny * EXCHANGE_RATE * Number(manual.quantity || 1);
    const commission = productCost * COMMISSION_RATE;
    return {
      productCost: Math.round(productCost),
      commission: Math.round(commission),
      total: Math.round(productCost + commission),
    };
  }, [activePriceCny, manual.quantity]);

  const { data: mySourcings } = useQuery({
    queryKey: ["my-sourcings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_sourcing_orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cargo } = useQuery({
    queryKey: ["cargo-config"],
    queryFn: async () => {
      const { data } = await supabase.from("cargo_config").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  async function approveQC(id: string) {
    const { error } = await supabase
      .from("custom_sourcing_orders")
      .update({ qc_approved_at: new Date().toISOString(), status: "shipped" } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Qualité approuvée — expédition en cours");
      qc.invalidateQueries({ queryKey: ["my-sourcings"] });
    }
  }

  async function scan() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/sourcing" } as never });
      return;
    }
    if (!url.trim()) {
      toast.error("Collez d'abord le lien du produit");
      return;
    }
    setScanning(true);
    setScanned(null);
    setSelectedVariant(null);
    try {
      const result = await scanFn({ data: { url: url.trim() } });
      setScanned(result);
      setManual((m) => ({
        ...m,
        product_name: result.title,
        cny_unit_price: String(result.price_cny || ""),
      }));
      if (result.variants.length === 0) {
        toast.success("Produit détecté !");
      } else {
        toast.success(`${result.variants.length} variante(s) détectée(s) — sélectionnez la vôtre`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan échoué");
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/sourcing" } as never });
      return;
    }
    if (!manual.product_name.trim() || !url.trim()) {
      toast.error("Lien et nom du produit requis");
      return;
    }
    setSubmitting(true);
    try {
      const productCost = Math.round(activePriceCny * EXCHANGE_RATE * Number(manual.quantity));
      const commission = Math.round(productCost * COMMISSION_RATE);
      const variantLabel = selectedVariant?.label ?? null;
      const { data: inserted, error } = await supabase
        .from("custom_sourcing_orders")
        .insert({
          user_id: user.id,
          source_url: url.trim(),
          product_name: manual.product_name.trim(),
          variant: variantLabel,
          cny_unit_price: activePriceCny || null,
          quantity: Number(manual.quantity),
          exchange_rate_cny_xof: EXCHANGE_RATE,
          msn_commission_rate: COMMISSION_RATE,
          msn_commission_xof: commission,
          estimated_total_xof: productCost + commission,
          shipping_type: manual.shipping_type,
          notes: manual.notes.trim() || null,
          main_image: selectedVariant?.image ?? scanned?.main_image ?? null,
          source_platform: scanned?.source_platform ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Demande envoyée. L'admin recevra tous les détails.");
      qc.invalidateQueries({ queryKey: ["my-sourcings"] });
      setUrl("");
      setScanned(null);
      setSelectedVariant(null);
      setManual({ product_name: "", cny_unit_price: "", quantity: 1, shipping_type: "sea", notes: "" });
      if (inserted?.id) {
        // Optional: keep user on page; they can pay from the history list
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <Header />
      <main className="flex-1 space-y-4 px-3 pb-6 pt-3">
        <div>
          <h1 className="font-display text-xl font-bold">Sourcing MSN</h1>
          <p className="text-sm text-muted-foreground">
            Collez un lien 1688 / Taobao / AliExpress — on scanne, on achète, on livre. Commission 7 %.
          </p>
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              URL du produit (1688, Taobao, Tmall, AliExpress, JD, Dewu…)
            </span>
            <div className="mt-1 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://detail.1688.com/…"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={scan}
                disabled={scanning || !url.trim()}
                className="flex items-center gap-1 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand disabled:opacity-60"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Scanner
              </button>
            </div>
          </label>

          {scanned && (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex gap-3">
                {(selectedVariant?.image ?? scanned.main_image) && (
                  <img
                    src={selectedVariant?.image ?? scanned.main_image!}
                    alt={scanned.title}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-primary">
                    {scanned.source_platform ?? "Produit détecté"}
                  </div>
                  <div className="text-sm font-semibold leading-tight line-clamp-3">{scanned.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Prix détecté : <span className="font-bold text-foreground">{scanned.price_cny || "?"} CNY</span>
                    {scanned.seller ? ` · ${scanned.seller}` : ""}
                  </div>
                </div>
              </div>

              {scanned.variants.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                    Choisissez votre variante
                  </div>
                  <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto">
                    {(scanned.variants as Variant[]).map((v: Variant, i: number) => (
                      <button
                        key={i}
                        onClick={() => setSelectedVariant(v)}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${
                          selectedVariant?.label === v.label
                            ? "border-primary bg-primary/10 font-bold"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="truncate">{v.label}</span>
                        {v.price_cny ? (
                          <span className="shrink-0 font-mono text-[11px]">{v.price_cny} CNY</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 block">
              <span className="text-xs font-semibold text-muted-foreground">Nom du produit</span>
              <input
                value={manual.product_name}
                onChange={(e) => setManual({ ...manual, product_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Prix unitaire CNY</span>
              <input
                type="number"
                inputMode="decimal"
                value={manual.cny_unit_price}
                onChange={(e) => setManual({ ...manual, cny_unit_price: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Quantité</span>
              <input
                type="number"
                min={1}
                value={manual.quantity}
                onChange={(e) => setManual({ ...manual, quantity: Math.max(1, Number(e.target.value)) })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-xl bg-muted p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estimation en direct
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span>Coût produit ({EXCHANGE_RATE} FCFA / CNY)</span>
              <span className="font-semibold">{formatXOF(preview.productCost)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Commission MSN (7 %)</span>
              <span className="font-semibold">{formatXOF(preview.commission)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-bold">
              <span>Total estimé (hors expédition)</span>
              <span className="font-display text-lg text-primary">{formatXOF(preview.total)}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Prix final confirmé par MSN après contact fournisseur. Vous paierez ensuite via MSN Smart Payment.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setManual({ ...manual, shipping_type: "sea" })}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                manual.shipping_type === "sea"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Ship className="h-4 w-4" /> Maritime
            </button>
            <button
              onClick={() => setManual({ ...manual, shipping_type: "air" })}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                manual.shipping_type === "air"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Plane className="h-4 w-4" /> Aérien
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Notes complémentaires</span>
            <textarea
              value={manual.notes}
              onChange={(e) => setManual({ ...manual, notes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          {!user ? (
            <Link
              to="/auth"
              search={{ redirect: "/sourcing" } as never}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand"
            >
              <LogIn className="h-4 w-4" /> Se connecter pour envoyer
            </Link>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60"
            >
              {submitting ? "Envoi…" : "Envoyer la demande à MSN"}
            </button>
          )}
        </section>

        {user && (mySourcings ?? []).length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Mes demandes ({mySourcings!.length})
            </h2>
            <ul className="space-y-2">
              {mySourcings!.map((s: any) => (
                <li key={s.id} className="space-y-2 rounded-xl bg-card p-3 shadow-card">
                  <div className="flex items-center gap-3">
                    {s.main_image ? (
                      <img
                        src={s.main_image}
                        alt={s.product_name}
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-secondary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold">{s.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("fr-CI")} · qté {s.quantity}
                        {s.variant ? ` · ${s.variant}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-sm font-bold text-primary">
                        {s.final_total_xof
                          ? formatXOF(Number(s.final_total_xof))
                          : s.estimated_total_xof
                            ? formatXOF(Number(s.estimated_total_xof))
                            : "—"}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-secondary">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </div>
                    </div>
                  </div>
                  {s.status === "quoted" && s.final_total_xof && (
                    <button
                      onClick={() => toast.info("Paiement sourcing bientôt disponible")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Payer via MSN Smart Payment
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
