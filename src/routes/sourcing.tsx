import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Ship, Plane, LogIn, Package } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/sourcing")({
  head: () => ({
    meta: [
      { title: "Sourcing MSN — Achat proxy 1688 / Taobao" },
      {
        name: "description",
        content:
          "Trouvez un produit sur 1688 ou Taobao, MSN Courtier l'achète et vous le livre en Côte d'Ivoire. Estimation en direct.",
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

function SourcingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    source_url: "",
    product_name: "",
    variant: "",
    cny_unit_price: "",
    quantity: 1,
    shipping_type: "sea" as "sea" | "air",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const exchangeRate = 85;
  const commissionRate = 0.07;

  const preview = useMemo(() => {
    const cny = Number(form.cny_unit_price) || 0;
    const qty = Number(form.quantity) || 1;
    const productCost = cny * exchangeRate * qty;
    const commission = productCost * commissionRate;
    const total = productCost + commission;
    return {
      productCost: Math.round(productCost),
      commission: Math.round(commission),
      total: Math.round(total),
    };
  }, [form.cny_unit_price, form.quantity]);

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

  async function submit() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/sourcing" } as never });
      return;
    }
    if (!form.source_url.trim() || !form.product_name.trim()) {
      toast.error("URL et nom du produit requis");
      return;
    }
    setSubmitting(true);
    try {
      const cny = Number(form.cny_unit_price) || 0;
      const productCost = Math.round(cny * exchangeRate * Number(form.quantity));
      const commission = Math.round(productCost * commissionRate);
      const { error } = await supabase.from("custom_sourcing_orders").insert({
        user_id: user.id,
        source_url: form.source_url.trim(),
        product_name: form.product_name.trim(),
        variant: form.variant.trim() || null,
        cny_unit_price: cny || null,
        quantity: Number(form.quantity),
        exchange_rate_cny_xof: exchangeRate,
        msn_commission_rate: commissionRate,
        msn_commission_xof: commission,
        estimated_total_xof: productCost + commission,
        shipping_type: form.shipping_type,
        notes: form.notes.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Demande envoyée. L'équipe MSN vous répondra rapidement.");
      setForm({
        source_url: "",
        product_name: "",
        variant: "",
        cny_unit_price: "",
        quantity: 1,
        shipping_type: "sea",
        notes: "",
      });
      qc.invalidateQueries({ queryKey: ["my-sourcings"] });
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
            Trouvez sur 1688 / Taobao, on achète et on livre. Commission : 7 %.
          </p>
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">URL du produit (1688, Taobao, AliExpress)</span>
            <input
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://detail.1688.com/…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 block">
              <span className="text-xs font-semibold text-muted-foreground">Nom du produit</span>
              <input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-semibold text-muted-foreground">Variante (couleur, taille…)</span>
              <input
                value={form.variant}
                onChange={(e) => setForm({ ...form, variant: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Prix unitaire CNY</span>
              <input
                type="number"
                inputMode="decimal"
                value={form.cny_unit_price}
                onChange={(e) => setForm({ ...form, cny_unit_price: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Quantité</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-xl bg-muted p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estimation en direct
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span>Coût produit ({exchangeRate} FCFA / CNY)</span>
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
              L'équipe MSN confirme le prix final après contact avec le fournisseur.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setForm({ ...form, shipping_type: "sea" })}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                form.shipping_type === "sea"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Ship className="h-4 w-4" /> Maritime
            </button>
            <button
              onClick={() => setForm({ ...form, shipping_type: "air" })}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                form.shipping_type === "air"
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
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              {submitting ? "Envoi…" : "Envoyer la demande"}
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
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">{s.product_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("fr-CI")} · qté {s.quantity}
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
