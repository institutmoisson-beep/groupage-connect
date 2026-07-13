import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/payment-methods")({
  component: AdminPaymentMethods,
});

const TYPES: Array<{ value: string; label: string }> = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "crypto", label: "Crypto" },
  { value: "bank", label: "Virement bancaire" },
  { value: "cash", label: "Espèces" },
  { value: "other", label: "Autre" },
];

const EMPTY = {
  type: "mobile_money",
  name: "",
  account_identifier: "",
  account_holder: "",
  instructions: "",
  active: true,
  sort_order: 0,
};

function AdminPaymentMethods() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });

  const { data: rows } = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!draft.name.trim()) return toast.error("Nom requis");
    const { error } = await supabase.from("payment_methods").insert({
      ...draft,
      sort_order: Number(draft.sort_order),
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Moyen de paiement ajouté");
    setDraft({ ...EMPTY });
    setCreating(false);
    qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
  }

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("payment_methods").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce moyen de paiement ?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold">Moyens de paiement</h1>
          <p className="text-xs text-muted-foreground">
            Ajoutez Wave, Orange Money, USDT, virements… Ce que les utilisateurs verront au checkout.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau
        </button>
      </div>

      {creating && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              className="rounded-lg border border-border bg-card px-2 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Nom (ex: Wave)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="rounded-lg border border-border bg-card px-2 py-2 text-sm"
            />
            <input
              placeholder="Numéro / adresse wallet"
              value={draft.account_identifier}
              onChange={(e) => setDraft({ ...draft, account_identifier: e.target.value })}
              className="col-span-2 rounded-lg border border-border bg-card px-2 py-2 text-sm"
            />
            <input
              placeholder="Titulaire du compte"
              value={draft.account_holder}
              onChange={(e) => setDraft({ ...draft, account_holder: e.target.value })}
              className="col-span-2 rounded-lg border border-border bg-card px-2 py-2 text-sm"
            />
            <textarea
              placeholder="Instructions (affichées au client)"
              value={draft.instructions}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              className="col-span-2 min-h-[60px] rounded-lg border border-border bg-card px-2 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Ordre"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              className="rounded-lg border border-border bg-card px-2 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Actif
            </label>
          </div>
          <button
            onClick={create}
            className="w-full rounded-lg bg-gradient-brand py-2 text-sm font-bold text-primary-foreground shadow-brand"
          >
            Créer
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {(rows ?? []).map((r: any) => (
          <MethodRow key={r.id} row={r} onSave={save} onDelete={del} />
        ))}
      </ul>
    </div>
  );
}

function MethodRow({
  row,
  onSave,
  onDelete,
}: {
  row: any;
  onSave: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
}) {
  const [edit, setEdit] = useState({ ...row });
  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={edit.type}
          onChange={(e) => setEdit({ ...edit, type: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={edit.account_identifier ?? ""}
          onChange={(e) => setEdit({ ...edit, account_identifier: e.target.value })}
          placeholder="Numéro / wallet"
          className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
        />
        <input
          value={edit.account_holder ?? ""}
          onChange={(e) => setEdit({ ...edit, account_holder: e.target.value })}
          placeholder="Titulaire"
          className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <textarea
          value={edit.instructions ?? ""}
          onChange={(e) => setEdit({ ...edit, instructions: e.target.value })}
          className="col-span-2 min-h-[50px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          placeholder="Instructions"
        />
        <input
          type="number"
          value={edit.sort_order}
          onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!edit.active}
            onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
          />
          Actif
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onDelete(row.id)}
          className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
        <button
          onClick={() =>
            onSave(row.id, {
              type: edit.type,
              name: edit.name,
              account_identifier: edit.account_identifier,
              account_holder: edit.account_holder,
              instructions: edit.instructions,
              sort_order: Number(edit.sort_order),
              active: edit.active,
            })
          }
          className="flex items-center gap-1 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Save className="h-3.5 w-3.5" /> Enregistrer
        </button>
      </div>
    </li>
  );
}
