import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (rows ?? []).filter((r) =>
    !q
      ? true
      : (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.phone ?? "").includes(q) ||
        (r.referral_code ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  async function save(id: string, patch: Partial<{ full_name: string; phone: string; city: string; mlm_level: number }>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce profil ? (compte auth conservé)")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black">Utilisateurs / Profils</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} profils</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher nom / tel / code…"
          className="w-64 rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Nom</th>
              <th className="p-2">Téléphone</th>
              <th className="p-2">Ville</th>
              <th className="p-2">Code parrain</th>
              <th className="p-2">Parrain</th>
              <th className="p-2">Niveau</th>
              <th className="p-2">CGV</th>
              <th className="p-2">Créé</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <UserRow key={p.id} row={p} onSave={save} onDelete={del} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({
  row,
  onSave,
  onDelete,
}: {
  row: any;
  onSave: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
}) {
  const [full_name, setName] = useState(row.full_name ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [city, setCity] = useState(row.city ?? "");
  const [mlm_level, setLvl] = useState<number>(row.mlm_level ?? 1);
  return (
    <tr className="border-b border-border">
      <td className="p-2">
        <input value={full_name} onChange={(e) => setName(e.target.value)} className="w-40 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-32 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">
        <input value={city} onChange={(e) => setCity(e.target.value)} className="w-28 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2 font-mono text-[10px]">{row.referral_code}</td>
      <td className="p-2 font-mono text-[10px]">{row.referred_by?.slice(0, 8) ?? "—"}</td>
      <td className="p-2">
        <input type="number" value={mlm_level} onChange={(e) => setLvl(Number(e.target.value))} className="w-14 rounded border border-input bg-background px-2 py-1" />
      </td>
      <td className="p-2">{row.terms_accepted_at ? "✓" : "—"}</td>
      <td className="p-2 text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString("fr-CI")}</td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onSave(row.id, { full_name, phone, city, mlm_level })}
            className="rounded bg-primary p-1.5 text-primary-foreground hover:bg-primary/90"
            aria-label="Enregistrer"
          >
            <Save className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(row.id)}
            className="rounded bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/90"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
