import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Warehouse } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/cargo")({
  component: AdminCargo,
});

function AdminCargo() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cargo-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cargo_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({
    china_warehouse_address: "",
    china_warehouse_contact: "",
    instructions: "",
  });
  useEffect(() => {
    if (data) {
      setForm({
        china_warehouse_address: data.china_warehouse_address ?? "",
        china_warehouse_contact: data.china_warehouse_contact ?? "",
        instructions: data.instructions ?? "",
      });
    }
  }, [data]);

  async function save() {
    const { error } = await supabase
      .from("cargo_config")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) toast.error(error.message);
    else {
      toast.success("Configuration cargo enregistrée");
      qc.invalidateQueries({ queryKey: ["cargo-config"] });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Warehouse className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg font-bold">MSN Global Cargo — Entrepôt Chine</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Adresse que les fournisseurs chinois utiliseront pour livrer les colis avant le regroupement et l'expédition
        vers Abidjan. Visible par tous les clients dans leurs commandes de sourcing.
      </p>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Adresse entrepôt (Chine)</span>
          <textarea
            value={form.china_warehouse_address}
            onChange={(e) => setForm({ ...form, china_warehouse_address: e.target.value })}
            rows={4}
            placeholder="Ex : MSN Cargo, No 88 Baiyun Rd, Guangzhou, Guangdong, 510000, China"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Contact / téléphone Chine</span>
          <input
            value={form.china_warehouse_contact}
            onChange={(e) => setForm({ ...form, china_warehouse_contact: e.target.value })}
            placeholder="Ex : +86 138 0000 0000 · Mr. Chen"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Instructions pour le fournisseur</span>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            rows={4}
            placeholder="Ex : Joindre le code de tracking MSN sur chaque colis (MSN-XXXX)."
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end">
          <button
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand"
          >
            <Save className="h-3.5 w-3.5" /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
