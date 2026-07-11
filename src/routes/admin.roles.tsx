import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/roles")({
  component: AdminRoles,
});

function AdminRoles() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"admin" | "member">("admin");

  const { data: rows } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles!inner(full_name, referral_code)")
        .order("role");
      if (error) throw error;
      return data;
    },
  });

  async function grant() {
    if (!userId) return toast.error("UUID utilisateur requis");
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else {
      toast.success("Rôle attribué");
      setUserId("");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    }
  }

  async function revoke(id: string) {
    if (!confirm("Retirer ce rôle ?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Retiré");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-black">Rôles utilisateurs</h1>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attribuer un rôle</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="UUID utilisateur (auth.users.id)"
            className="flex-1 min-w-64 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          >
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>
          <button
            onClick={grant}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand"
          >
            <Plus className="h-3.5 w-3.5" /> Attribuer
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Astuce : trouvez l'UUID dans l'onglet Utilisateurs.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[600px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Utilisateur</th>
              <th className="p-2">Code parrain</th>
              <th className="p-2">UUID</th>
              <th className="p-2">Rôle</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-b border-border">
                <td className="p-2 font-semibold">{r.profiles?.full_name ?? "—"}</td>
                <td className="p-2 font-mono text-[10px]">{r.profiles?.referral_code ?? "—"}</td>
                <td className="p-2 font-mono text-[10px]">{r.user_id}</td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {r.role}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => revoke(r.id)}
                    className="rounded bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/90"
                    aria-label="Retirer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
