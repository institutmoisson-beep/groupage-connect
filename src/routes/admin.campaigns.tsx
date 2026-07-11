import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/campaigns")({
  component: AdminCampaigns,
});

const EMPTY = {
  title: "",
  description: "",
  shipping_type: "sea" as "sea" | "air",
  target_quantity: 100,
  end_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  eta_days: 45,
  container_image: "",
  status: "open" as "open" | "closed" | "shipped" | "arrived",
};

function AdminCampaigns() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });

  const { data: rows } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groupage_campaigns").select("*").order("end_date");
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    const { error } = await supabase.from("groupage_campaigns").insert({
      ...draft,
      end_date: new Date(draft.end_date).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Campagne créée");
    setCreating(false);
    setDraft({ ...EMPTY });
    qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  }

  async function save(id: string, patch: any) {
    const { error } = await supabase.from("groupage_campaigns").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    }
  }

  async function del(id: string) {
    if (!confirm("Supprimer cette campagne ?")) return;
    const { error } = await supabase.from("groupage_campaigns").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimée");
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black">Campagnes Groupage</h1>
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand">
          <Plus className="h-3.5 w-3.5" /> Nouvelle campagne
        </button>
      </div>

      {creating && (
        <div className="grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs md:grid-cols-2">
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">Titre</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">Type</span>
            <select value={draft.shipping_type} onChange={(e) => setDraft({ ...draft, shipping_type: e.target.value as any })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5">
              <option value="sea">Maritime</option>
              <option value="air">Aérien</option>
            </select>
          </label>
          <label className="md:col-span-2"><span className="text-[10px] font-bold uppercase text-muted-foreground">Description</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">Quantité cible</span><input type="number" value={draft.target_quantity} onChange={(e) => setDraft({ ...draft, target_quantity: Number(e.target.value) })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">ETA (jours)</span><input type="number" value={draft.eta_days} onChange={(e) => setDraft({ ...draft, eta_days: Number(e.target.value) })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">Fin</span><input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <label><span className="text-[10px] font-bold uppercase text-muted-foreground">Image container</span><input value={draft.container_image} onChange={(e) => setDraft({ ...draft, container_image: e.target.value })} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5" /></label>
          <div className="md:col-span-2"><button onClick={create} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Créer</button></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Titre</th>
              <th className="p-2">Type</th>
              <th className="p-2">Progression</th>
              <th className="p-2">Fin</th>
              <th className="p-2">ETA</th>
              <th className="p-2">Statut</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((c) => (
              <CampaignRow key={c.id} row={c} onSave={save} onDelete={del} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignRow({ row, onSave, onDelete }: { row: any; onSave: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(row.title);
  const [target_quantity, setTarget] = useState<number>(row.target_quantity);
  const [current_participants, setCurr] = useState<number>(row.current_participants);
  const [status, setStatus] = useState(row.status);
  const [eta_days, setEta] = useState<number>(row.eta_days);
  return (
    <tr className="border-b border-border">
      <td className="p-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-48 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2 uppercase">{row.shipping_type}</td>
      <td className="p-2">
        <input type="number" value={current_participants} onChange={(e) => setCurr(Number(e.target.value))} className="w-16 rounded border border-input bg-background px-2 py-1" /> /
        <input type="number" value={target_quantity} onChange={(e) => setTarget(Number(e.target.value))} className="ml-1 w-16 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2 text-[10px] text-muted-foreground">{new Date(row.end_date).toLocaleDateString("fr-CI")}</td>
      <td className="p-2">
        <input type="number" value={eta_days} onChange={(e) => setEta(Number(e.target.value))} className="w-16 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-input bg-background px-2 py-1">
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="shipped">shipped</option>
          <option value="arrived">arrived</option>
        </select>
      </td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => onSave(row.id, { title, target_quantity, current_participants, status, eta_days })} className="rounded bg-primary p-1.5 text-primary-foreground">
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
