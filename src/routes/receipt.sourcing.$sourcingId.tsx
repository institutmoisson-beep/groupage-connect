import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/receipt/sourcing/$sourcingId")({
  head: () => ({
    meta: [{ title: "Reçu & Contrat — MSN Courtier" }, { name: "robots", content: "noindex" }],
  }),
  component: SourcingReceiptPage,
});

const DELAY_ESTIMATE: Record<string, string> = {
  sea: "45 à 60 jours ouvrés (groupage maritime, sous réserve des formalités douanières)",
  air: "10 à 15 jours ouvrés (fret aérien express, sous réserve des formalités douanières)",
};

function SourcingReceiptPage() {
  const { sourcingId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["sourcing-receipt", sourcingId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_sourcing_orders")
        .select("*, profiles(full_name, phone)")
        .eq("id", sourcingId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: proof } = useQuery({
    queryKey: ["sourcing-receipt-proof", sourcingId],
    enabled: !!order,
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_proofs")
        .select("*, payment_methods(name)")
        .eq("sourcing_order_id", sourcingId)
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  if (loading || isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    navigate({ to: "/auth", search: { redirect: `/receipt/sourcing/${sourcingId}` } as never });
    return null;
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-muted-foreground">Reçu introuvable.</p>
        <Link to="/sourcing" className="mt-3 inline-block text-sm font-semibold text-primary">
          ← Sourcing
        </Link>
      </div>
    );
  }

  const isPaid = ["paid", "ordered_china", "qc", "shipped", "transit", "abidjan", "delivered"].includes(order.status);
  if (!isPaid) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-muted-foreground">Le reçu sera disponible une fois le paiement confirmé par MSN.</p>
        <Link to="/sourcing" className="mt-3 inline-block text-sm font-semibold text-primary">
          ← Sourcing
        </Link>
      </div>
    );
  }

  const receiptNumber = `MSN-RCT-${String(order.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const amount = Number(order.final_total_xof ?? order.estimated_total_xof ?? 0);
  const commission = Number(order.msn_commission_xof ?? 0);
  const productCost = amount - commission;
  const paidDate = proof?.created_at ? new Date(proof.created_at) : new Date(order.updated_at ?? order.created_at);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur print:hidden">
        <button
          onClick={() => history.back()}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-sm font-semibold">Reçu & contrat de livraison</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
        </button>
      </header>

      <main className="space-y-5 p-4 text-sm leading-relaxed">
        <div className="text-center">
          <div className="font-display text-lg font-black text-primary">MSN Courtier</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Reçu de paiement &amp; contrat de livraison — Sourcing
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success/10 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <div>
              <div className="text-xs font-bold text-success">Paiement confirmé</div>
              <div className="text-[10px] text-muted-foreground">{paidDate.toLocaleDateString("fr-CI", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">N° reçu</div>
            <div className="font-mono text-xs font-bold">{receiptNumber}</div>
          </div>
        </div>

        <section>
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Client</h2>
          <div className="rounded-xl bg-card p-3 shadow-card">
            <div className="font-semibold">{order.profiles?.full_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{order.profiles?.phone ?? "—"}</div>
          </div>
        </section>

        <section>
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Récapitulatif de l'achat</h2>
          <div className="space-y-2 rounded-xl bg-card p-3 shadow-card">
            <div className="flex gap-3">
              {order.main_image && (
                <img src={order.main_image} alt={order.product_name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{order.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {order.source_platform ?? "Marketplace"} {order.variant ? `· ${order.variant}` : ""} · qté {order.quantity}
                </div>
                <div className="text-xs text-muted-foreground">
                  Expédition : {order.shipping_type === "air" ? "Aérien express" : "Maritime groupage"}
                </div>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            <Row label="Coût produit" value={formatXOF(Math.max(0, productCost))} />
            <Row label="Commission MSN" value={formatXOF(commission)} />
            <Row label="Total payé" value={formatXOF(amount)} big />
          </div>
        </section>

        {proof && (
          <section>
            <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Détails du paiement</h2>
            <div className="space-y-1 rounded-xl bg-card p-3 text-xs shadow-card">
              <Row label="Moyen de paiement" value={proof.payment_methods?.name ?? "—"} />
              <Row label="Référence transaction" value={proof.reference ?? "—"} />
              <Row label="Montant" value={formatXOF(Number(proof.amount_xof))} />
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contrat de livraison</h2>
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
            <p>
              <strong>1. Objet.</strong> MSN Courtier s'engage à commander, réceptionner, contrôler la qualité et
              acheminer le produit décrit ci-dessus jusqu'à Abidjan, pour le compte du client identifié sur ce reçu.
            </p>
            <p>
              <strong>2. Délai estimé.</strong> {DELAY_ESTIMATE[order.shipping_type] ?? DELAY_ESTIMATE.sea} à compter
              de la confirmation du paiement. Ce délai est une estimation et non un engagement de date fixe.
            </p>
            <p>
              <strong>3. Contrôle qualité.</strong> Le produit fait l'objet d'une vérification par l'équipe MSN avant
              expédition. Le client peut être sollicité pour approuver des photos de contrôle qualité avant le départ
              du colis.
            </p>
            <p>
              <strong>4. Communication.</strong> Toute question relative à cette commande peut être adressée
              directement à MSN via le canal de discussion dédié à cette demande, accessible depuis la page Sourcing.
            </p>
            <p>
              <strong>5. Litiges.</strong> En cas de non-conformité constatée à la réception, le client dispose de
              72 heures pour le signaler via le canal de discussion afin d'ouvrir une réclamation.
            </p>
          </div>
        </section>

        <p className="text-center text-[10px] text-muted-foreground">
          Document généré automatiquement le {new Date().toLocaleDateString("fr-CI")} — MSN Courtier
        </p>
      </main>
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={big ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={big ? "font-display text-base font-black text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}
