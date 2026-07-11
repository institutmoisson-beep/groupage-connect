import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Ship, Plane, Share2, Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProgressBar } from "@/components/ProgressBar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { TermsDialog } from "@/components/TermsDialog";
import {
  productQuery,
  campaignsQuery,
  campaignProductsQuery,
  activeCampaignForProduct,
} from "@/lib/queries";
import { formatXOF, computePrice, computeProductCostXOF } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { initiateGeniusPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.id));
    if (!p) throw notFound();
    context.queryClient.ensureQueryData(campaignsQuery());
    context.queryClient.ensureQueryData(campaignProductsQuery());
    return { title: p.title };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — MSN Courtier` : "Produit — MSN Courtier" },
    ],
  }),
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <p className="text-muted-foreground">Produit introuvable.</p>
      <Link to="/" className="mt-3 inline-block text-sm font-semibold text-primary">
        Retour à l'accueil
      </Link>
    </div>
  ),
});

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: product } = useSuspenseQuery(productQuery(id));
  const { data: campaigns } = useSuspenseQuery(campaignsQuery());
  const { data: cps } = useSuspenseQuery(campaignProductsQuery());
  const [ordering, setOrdering] = useState(false);
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const campaign = activeCampaignForProduct(cps, campaigns, product.id);
  const productCost = computeProductCostXOF(product);
  const totalUnit = computePrice(product);
  const total = totalUnit * qty;

  async function placeOrder(shipping: "sea" | "air") {
    setOrdering(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Connectez-vous pour commander");
        navigate({ to: "/auth", search: { redirect: `/product/${id}` } });
        return;
      }
      const { error } = await supabase.from("orders").insert({
        user_id: session.session.user.id,
        product_id: product!.id,
        campaign_id: shipping === "sea" && campaign ? campaign.id : null,
        quantity: qty,
        unit_price_xof: totalUnit,
        total_xof: total,
        shipping_type: shipping,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Commande créée — en attente de paiement");
      navigate({ to: "/orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la commande");
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <button
          onClick={() => history.back()}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="line-clamp-1 flex-1 text-sm font-semibold">{product.title}</h1>
        <button
          onClick={() => {
            navigator.share?.({ title: product.title, url: window.location.href }).catch(() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Lien copié");
            });
          }}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
          aria-label="Partager"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 pb-32">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={product.image_urls[0]}
            alt={product.title}
            className="h-full w-full object-cover"
          />
          <span className="absolute right-3 top-3 rounded-md bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-secondary-foreground">
            {product.category}
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">{product.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
          </div>

          {campaign && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <Ship className="h-3 w-3" /> {campaign.title}
                </span>
                <CountdownTimer endDate={campaign.end_date} compact />
              </div>
              <ProgressBar
                current={campaign.current_participants}
                target={campaign.target_quantity}
              />
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Détail du prix
            </h3>
            <Row label={`Coût produit (${product.cny_price} CNY × ${product.exchange_rate_cny_xof})`} value={formatXOF(productCost)} />
            <Row label="Frais d'importation groupage" value={formatXOF(product.logistics_fee_xof)} />
            <div className="my-2 h-px bg-border" />
            <Row label="Prix unitaire" value={formatXOF(totalUnit)} big />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-semibold">Quantité</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card font-bold shadow-card"
              >
                −
              </button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card font-bold shadow-card"
              >
                +
              </button>
            </div>
          </div>

          <a
            href={product.image_urls[0]}
            download
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/5"
          >
            <Download className="h-4 w-4" /> Télécharger l'image pour partager
          </a>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 p-3 backdrop-blur">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-display text-xl font-black text-primary">{formatXOF(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => placeOrder("sea")}
            disabled={ordering}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-3 text-xs font-bold text-primary-foreground shadow-brand transition active:scale-95 disabled:opacity-60"
          >
            <Ship className="h-4 w-4" /> Groupage Maritime
          </button>
          <button
            onClick={() => placeOrder("air")}
            disabled={ordering}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-premium px-3 py-3 text-xs font-bold text-secondary-foreground shadow-premium transition active:scale-95 disabled:opacity-60"
          >
            <Plane className="h-4 w-4" /> Express Aérien
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={big ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={big ? "font-display text-lg font-black text-primary" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}
