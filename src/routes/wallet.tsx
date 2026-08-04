import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Banknote, Wallet } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { getWalletSummary, requestWithdrawal } from "@/lib/wallet.functions";
import { WALLET_TX_LABELS, WITHDRAWAL_METHOD_LABELS, WITHDRAWAL_STATUS_LABELS } from "@/lib/stock";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Mon portefeuille MSN — Soldes & retraits" },
      {
        name: "description",
        content:
          "Consultez votre solde MSN, l'historique de vos commissions et parts grossistes, et demandez un retrait via Wave, Orange Money, MTN, Moov ou virement bancaire.",
      },
      { property: "og:title", content: "Mon portefeuille MSN" },
      { property: "og:description", content: "Soldes en temps réel, historique des transactions et retraits mobile money." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletPage,
});

const METHODS = ["wave", "orange_money", "mtn_money", "moov_money", "bank_transfer"] as const;

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const summaryFn = useServerFn(getWalletSummary);
  const withdrawFn = useServerFn(requestWithdrawal);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("wave");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["wallet-summary", user?.id],
    enabled: !!user,
    queryFn: () => summaryFn({ data: undefined as never }),
  });

  const { data: txs } = useQuery({
    queryKey: ["wallet-txs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["wallet-withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const amountXof = Number(amount);
      if (!Number.isFinite(amountXof)) throw new Error("Montant invalide.");
      return withdrawFn({
        data: { amountXof, method, accountIdentifier: account.trim(), accountHolder: holder.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Demande de retrait envoyée ✅");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      qc.invalidateQueries({ queryKey: ["wallet-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <h1 className="font-display text-lg font-black">
          <Wallet className="mr-1 inline h-5 w-5 text-primary" /> Portefeuille MSN
        </h1>

        {!user ? (
          <Link to="/auth" className="mt-4 inline-block text-sm text-primary underline">
            Se connecter
          </Link>
        ) : (
          <>
            <section className="mt-3 rounded-2xl bg-gradient-brand p-4 text-primary-foreground shadow-brand">
              <p className="text-[11px] uppercase tracking-wider opacity-80">Solde disponible</p>
              <p className="font-display text-3xl font-black">{formatXOF(Number(summary?.available ?? 0))}</p>
              <div className="mt-2 flex gap-4 text-[11px] opacity-90">
                <span>Solde total : {formatXOF(Number(summary?.balance ?? 0))}</span>
                <span>Retraits en cours : {formatXOF(Number(summary?.pending ?? 0))}</span>
              </div>
            </section>

            <section className="mt-4 rounded-xl border border-border bg-card p-3">
              <h2 className="text-sm font-bold">
                <Banknote className="mr-1 inline h-4 w-4" /> Demander un retrait
              </h2>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Montant (FCFA)</span>
                  <input
                    type="number"
                    min={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Moyen de paiement</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {WITHDRAWAL_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {method === "bank_transfer" ? "IBAN / RIB" : "Numéro mobile money"}
                  </span>
                  <input
                    value={account}
                    maxLength={60}
                    onChange={(e) => setAccount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Titulaire du compte</span>
                  <input
                    value={holder}
                    maxLength={120}
                    onChange={(e) => setHolder(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                  />
                </label>
                <button
                  disabled={submit.isPending}
                  onClick={() => submit.mutate()}
                  className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-black text-primary-foreground shadow-brand disabled:opacity-60"
                >
                  {submit.isPending ? "Envoi…" : "Envoyer la demande"}
                </button>
                <p className="text-center text-[10px] text-muted-foreground">
                  Minimum 1 000 FCFA. Les retraits sont traités par la logistique MSN sous 24-72h.
                </p>
              </div>
            </section>

            {withdrawals && withdrawals.length > 0 && (
              <section className="mt-4">
                <h2 className="text-sm font-bold">Mes retraits</h2>
                <ul className="mt-2 space-y-2">
                  {withdrawals.map((w) => (
                    <li key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
                      <div>
                        <p className="font-bold">{formatXOF(Number(w.amount_xof))}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {WITHDRAWAL_METHOD_LABELS[w.method] ?? w.method} · {w.account_identifier}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                        {WITHDRAWAL_STATUS_LABELS[w.status] ?? w.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-4">
              <h2 className="text-sm font-bold">Historique</h2>
              {!txs?.length ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucune transaction pour l'instant.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {txs.map((t) => {
                    const credit = Number(t.amount_xof) >= 0;
                    return (
                      <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">{t.label}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {WALLET_TX_LABELS[t.type] ?? t.type} ·{" "}
                            {new Date(t.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-black ${credit ? "text-success" : "text-destructive"}`}>
                          {credit ? (
                            <ArrowDownLeft className="mr-1 inline h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />
                          )}
                          {formatXOF(Math.abs(Number(t.amount_xof)))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
