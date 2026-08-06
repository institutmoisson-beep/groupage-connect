import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { WALLET_TX_LABELS } from "@/lib/stock";

export const Route = createFileRoute("/admin/wallets")({
  head: () => ({
    meta: [
      { title: "Portefeuilles Stock Express — Administration MSN" },
      {
        name: "description",
        content:
          "Créditez ou débitez manuellement le portefeuille des importateurs et revendeurs MSN Stock Express.",
      },
      { property: "og:title", content: "Portefeuilles Stock Express — Administration MSN" },
      { property: "og:description", content: "Ajustements manuels des soldes portefeuille des utilisateurs du stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWallets,
});

function AdminWallets() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["admin-wallet-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["admin-wallet-txs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("user_id, amount_xof, type, label, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const balances = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs ?? []) m.set(t.user_id, (m.get(t.user_id) ?? 0) + Number(t.amount_xof ?? 0));
    return m;
  }, [txs]);

  const filtered = (profiles ?? []).filter((p) =>
    !q
      ? true
      : (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (p.phone ?? "").includes(q),
  );

  const adjust = useMutation({
    mutationFn: async (v: { userId: string; amount: number; label: string }) => {
      const { error } = await (supabase as any).rpc("admin_adjust_wallet", {
        p_user_id: v.userId,
        p_amount_xof: v.amount,
        p_label: v.label,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Portefeuille ajusté");
      setAmount("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["admin-wallet-txs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function run(sign: 1 | -1) {
    if (!selected) return toast.error("Sélectionnez un utilisateur.");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Montant invalide.");
    if (label.trim().length < 3) return toast.error("Indiquez un motif.");
    adjust.mutate({ userId: selected, amount: sign * value, label: label.trim().slice(0, 200) });
  }

  const selectedTxs = (txs ?? []).filter((t) => t.user_id === selected).slice(0, 15);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-black">Portefeuilles Stock Express</h1>
        <p className="text-xs text-muted-foreground">
          Créditez (bonus, régularisation, encaissement cash reçu) ou débitez (avance, erreur, retenue) le
          portefeuille d'un utilisateur. Chaque mouvement est tracé avec son motif.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher nom / téléphone…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary md:w-72"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <ul className="max-h-96 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs ${selected === p.id ? "bg-primary/10 font-bold" : "hover:bg-muted/60"}`}
              >
                <span className="truncate">
                  {p.full_name ?? "Utilisateur"}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
                <span className="shrink-0 font-bold">{formatXOF(balances.get(p.id) ?? 0)}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-2 text-xs text-muted-foreground">Aucun utilisateur trouvé.</li>
          )}
        </ul>

        <div className="rounded-xl border border-border bg-card p-3">
          {!selected ? (
            <p className="text-xs text-muted-foreground">Sélectionnez un utilisateur à gauche.</p>
          ) : (
            <>
              <p className="text-xs font-bold">
                Solde actuel : {formatXOF(balances.get(selected) ?? 0)}
              </p>
              <label className="mt-2 block">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Montant (FCFA)
                </span>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </label>
              <label className="mt-2 block">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Motif</span>
                <input
                  value={label}
                  maxLength={200}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex. Encaissement cash livraison hors app"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </label>
              <div className="mt-3 flex gap-2 text-xs font-bold">
                <button
                  disabled={adjust.isPending}
                  onClick={() => run(1)}
                  className="flex-1 rounded-lg bg-success px-3 py-2 text-success-foreground disabled:opacity-60"
                >
                  Créditer
                </button>
                <button
                  disabled={adjust.isPending}
                  onClick={() => run(-1)}
                  className="flex-1 rounded-lg bg-destructive px-3 py-2 text-destructive-foreground disabled:opacity-60"
                >
                  Débiter
                </button>
              </div>

              <h2 className="mt-4 text-xs font-bold">Derniers mouvements</h2>
              <ul className="mt-1 space-y-1">
                {selectedTxs.map((t, i) => (
                  <li key={`${t.created_at}-${i}`} className="flex justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted-foreground">
                      {WALLET_TX_LABELS[t.type] ?? t.type} — {t.label}
                    </span>
                    <span className={Number(t.amount_xof) < 0 ? "text-destructive" : "text-success"}>
                      {formatXOF(Number(t.amount_xof))}
                    </span>
                  </li>
                ))}
                {selectedTxs.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">Aucun mouvement.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
