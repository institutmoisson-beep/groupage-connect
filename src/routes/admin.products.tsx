import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Plus, Upload, X, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF, computePrice } from "@/lib/format";
import { compressAndUploadImage } from "@/lib/image-upload";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

const EMPTY = {
  title: "",
  description: "",
  category: "electronique",
  image_urls: "",
  cny_price: 0,
  logistics_fee_xof: 0,
  exchange_rate_cny_xof: 85,
  active: true,
};

function AdminProducts() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });

  const { data: rows } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    const payload = {
      ...draft,
      image_urls: draft.image_urls
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cny_price: Number(draft.cny_price),
      logistics_fee_xof: Number(draft.logistics_fee_xof),
      exchange_rate_cny_xof: Number(draft.exchange_rate_cny_xof),
    };
    const { error } = await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Produit créé");
    setCreating(false);
    setDraft({ ...EMPTY });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  }

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black">Produits</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau produit
        </button>
      </div>

      {creating && (
        <div className="grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs md:grid-cols-2">
          <Input label="Titre" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
          <Input label="Catégorie" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
          <TextArea label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
          <TextArea
            label="URLs images (séparées par virgule)"
            value={draft.image_urls}
            onChange={(v) => setDraft({ ...draft, image_urls: v })}
          />
          <Input label="Prix CNY" type="number" value={String(draft.cny_price)} onChange={(v) => setDraft({ ...draft, cny_price: Number(v) })} />
          <Input label="Frais logistique XOF" type="number" value={String(draft.logistics_fee_xof)} onChange={(v) => setDraft({ ...draft, logistics_fee_xof: Number(v) })} />
          <Input label="Taux CNY→XOF" type="number" value={String(draft.exchange_rate_cny_xof)} onChange={(v) => setDraft({ ...draft, exchange_rate_cny_xof: Number(v) })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-primary" />
            <span>Actif</span>
          </label>
          <div className="md:col-span-2">
            <button onClick={create} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
              Créer
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1000px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Image</th>
              <th className="p-2">Titre</th>
              <th className="p-2">Catégorie</th>
              <th className="p-2">CNY</th>
              <th className="p-2">Taux</th>
              <th className="p-2">Frais log.</th>
              <th className="p-2">Prix final</th>
              <th className="p-2">Actif</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((p) => (
              <ProductRow key={p.id} row={p} onSave={save} onDelete={del} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({ row, onSave, onDelete }: { row: any; onSave: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(row.title);
  const [category, setCategory] = useState(row.category);
  const [cny_price, setCny] = useState<number>(row.cny_price);
  const [exchange_rate_cny_xof, setRate] = useState<number>(row.exchange_rate_cny_xof);
  const [logistics_fee_xof, setFee] = useState<number>(row.logistics_fee_xof);
  const [active, setActive] = useState(row.active);
  const total = computePrice({ cny_price, exchange_rate_cny_xof, logistics_fee_xof });
  return (
    <tr className="border-b border-border">
      <td className="p-2">
        <img src={row.image_urls?.[0]} alt="" className="h-10 w-10 rounded object-cover" />
      </td>
      <td className="p-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-56 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-24 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input type="number" value={cny_price} onChange={(e) => setCny(Number(e.target.value))} className="w-20 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input type="number" value={exchange_rate_cny_xof} onChange={(e) => setRate(Number(e.target.value))} className="w-16 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input type="number" value={logistics_fee_xof} onChange={(e) => setFee(Number(e.target.value))} className="w-24 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2 font-bold text-primary">{formatXOF(total)}</td>
      <td className="p-2">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-primary" />
      </td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => onSave(row.id, { title, category, cny_price, exchange_rate_cny_xof, logistics_fee_xof, active })} className="rounded bg-primary p-1.5 text-primary-foreground">
            <Save className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(row.id)} className="rounded bg-destructive p-1.5 text-destructive-foreground">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary" />
    </label>
  );
}
