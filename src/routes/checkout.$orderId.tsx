import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  Smartphone,
  Bitcoin,
  Landmark,
  Wallet as WalletIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { uploadPaymentProof } from "@/lib/proof-upload";

export const Route = createFileRoute("/checkout/$orderId")({
  head: () => ({ meta: [{ title: "Paiement — MSN Courtier" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

type PaymentMethod = {
  id: string;
  type: "mobile_money" | "crypto" | "bank" | "cash" | "other";
  name: string;
  account_identifier: string | null;
  account_holder: string | null;
  instructions: string | null;
  logo_url: string | null;
  sort_order: number;
};

const TYPE_ICON: Record<PaymentMethod["type"], typeof Smartphone> = {
  mobile_money: Smartphone,
  crypto: Bitcoin,
  bank: Landmark,
  cash: WalletIcon,
  other: WalletIcon,
};

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["checkout-order", orderId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_xof, quantity, shipping_type, payment_status, status, product_id, user_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: methods } = useQuery({
    queryKey: ["payment-methods-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    },
  });

  const { data: existingProofs } = useQuery({
    queryKey: ["proofs", orderId],
    enabled: !!user && !!orderId,
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_proofs")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      return data ?? [];
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
    navigate({ to: "/auth", search: { redirect: `/checkout/${orderId}` } as never });
    return null;
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-muted-foreground">Commande introuvable.</p>
        <Link to="/orders" className="mt-3 inline-block text-sm font-semibold text-primary">
          Mes commandes
        </Link>
      </div>
    );
  }

  const paid = order.payment_status === "paid" || order.status === "paid_confirmed";
  const selected = methods?.find((m) => m.id === selectedId);
  const hasPendingProof = (existingProofs ?? []).some((p: any) => p.status === "pending");

  async function handleFile(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const { url } = await uploadPaymentProof(file, user.id);
      setProofUrl(url);
      toast.success("Preuve téléversée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  async function submitProof() {
    if (!selected) return toast.error("Choisissez un moyen de paiement");
    if (!reference.trim()) return toast.error("Saisissez la référence de la transaction");
    if (!proofUrl) return toast.error("Ajoutez une capture d'écran");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("payment_proofs").insert({
        order_id: orderId,
        user_id: user!.id,
        payment_method_id: selected.id,
        reference: reference.trim(),
        amount_xof: order!.total_xof,
        screenshot_url: proofUrl,
        note: note.trim() || null,
      });
      if (error) throw error;
      // Mark order as pending review
      await supabase
        .from("orders")
        .update({
          payment_provider: "manual",
          payment_status: "pending",
          payment_reference: reference.trim(),
        })
        .eq("id", orderId);
      toast.success("Preuve envoyée. En attente de validation.");
      qc.invalidateQueries({ queryKey: ["proofs", orderId] });
      qc.invalidateQueries({ queryKey: ["checkout-order", orderId] });
      setProofUrl(null);
      setReference("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
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
        <h1 className="flex-1 text-sm font-semibold">Paiement de la commande</h1>
      </header>

      <main className="flex-1 space-y-4 p-4 pb-24">
        <div className="rounded-2xl bg-gradient-brand p-4 text-primary-foreground shadow-brand">
          <div className="text-xs uppercase tracking-wider opacity-80">Montant à payer</div>
          <div className="mt-1 font-display text-3xl font-black">{formatXOF(Number(order.total_xof))}</div>
          <div className="mt-1 text-[11px] opacity-80">
            {order.quantity} × · {order.shipping_type === "sea" ? "Groupage maritime" : "Express aérien"}
          </div>
        </div>

        {paid ? (
          <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
            <p className="mt-2 text-sm font-semibold text-success">Paiement confirmé</p>
            <Link to="/orders" className="mt-3 inline-block text-xs font-semibold text-primary">
              Voir mes commandes →
            </Link>
          </div>
        ) : hasPendingProof ? (
          <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-center">
            <Clock className="mx-auto h-8 w-8 text-secondary" />
            <p className="mt-2 text-sm font-semibold">En attente de vérification</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Un administrateur valide votre paiement sous peu.
            </p>
            <Link to="/orders" className="mt-3 inline-block text-xs font-semibold text-primary">
              Voir mes commandes →
            </Link>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Choisissez un moyen de paiement
              </h2>
              {(methods ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Aucun moyen de paiement disponible. Contactez l'administrateur.
                </div>
              ) : (
                <div className="grid gap-2">
                  {methods!.map((m) => {
                    const Icon = TYPE_ICON[m.type];
                    const active = selectedId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedId(m.id)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/5 shadow-brand"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold">{m.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {m.type === "mobile_money"
                              ? "Mobile Money"
                              : m.type === "crypto"
                                ? "Crypto"
                                : m.type === "bank"
                                  ? "Virement bancaire"
                                  : m.type === "cash"
                                    ? "Espèces"
                                    : "Autre"}
                          </div>
                        </div>
                        {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selected && (
              <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  2. Envoyez le paiement
                </h3>
                {selected.account_identifier && (
                  <CopyRow label="Destinataire" value={selected.account_identifier} />
                )}
                {selected.account_holder && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Titulaire :</span>{" "}
                    <span className="font-semibold">{selected.account_holder}</span>
                  </div>
                )}
                <CopyRow label="Montant exact" value={formatXOF(Number(order.total_xof))} />
                {selected.instructions && (
                  <div className="rounded-lg bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                    {selected.instructions}
                  </div>
                )}
              </section>
            )}

            {selected && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  3. Envoyez la preuve
                </h3>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Référence / N° de transaction
                  </span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex: TAM12345678"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Note (optionnel)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </label>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Capture d'écran de la transaction
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  {proofUrl ? (
                    <div className="mt-1 relative overflow-hidden rounded-xl border border-border">
                      <img src={proofUrl} alt="Preuve" className="max-h-64 w-full object-contain bg-muted" />
                      <button
                        onClick={() => setProofUrl(null)}
                        className="absolute right-2 top-2 rounded-lg bg-background/90 px-2 py-1 text-xs font-semibold"
                      >
                        Remplacer
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-3 py-6 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Choisir une capture
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  onClick={submitProof}
                  disabled={submitting || !proofUrl || !reference.trim()}
                  className="w-full rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-primary-foreground shadow-brand transition active:scale-95 disabled:opacity-60"
                >
                  {submitting ? "Envoi…" : "Envoyer la preuve"}
                </button>
              </section>
            )}
          </>
        )}

        {(existingProofs ?? []).length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Historique des preuves
            </h3>
            <ul className="space-y-2">
              {existingProofs!.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-card p-3 text-xs shadow-card">
                  <div>
                    <div className="font-semibold">{p.reference}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("fr-CI")}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.status === "verified"
                        ? "bg-success/15 text-success"
                        : p.status === "rejected"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-secondary/15 text-secondary"
                    }`}
                  >
                    {p.status === "verified" ? "Validé" : p.status === "rejected" ? "Rejeté" : "En attente"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-card p-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-bold">{value}</div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copié");
        }}
        className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground"
        aria-label="Copier"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}
