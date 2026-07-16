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
    default_rate_per_kg_xof: "",
    default_rate_per_cbm_xof: "",
    default_customs_flat_fee_xof: "",
    local_hub_lat: "",
    local_hub_lng: "",
    delivery_base_fee_xof: "",
    delivery_rate_per_km_xof: "",
  });
  useEffect(() => {
    if (data) {
      setForm({
        china_warehouse_address: data.china_warehouse_address ?? "",
        china_warehouse_contact: data.china_warehouse_contact ?? "",
        instructions: data.instructions ?? "",
        default_rate_per_kg_xof: data.default_rate_per_kg_xof ?? "",
        default_rate_per_cbm_xof: data.default_rate_per_cbm_xof ?? "",
        default_customs_flat_fee_xof: data.default_customs_flat_fee_xof ?? "",
        local_hub_lat: data.local_hub_lat ?? "",
        local_hub_lng: data.local_hub_lng ?? "",
        delivery_base_fee_xof: data.delivery_base_fee_xof ?? "",
        delivery_rate_per_km_xof: data.delivery_rate_per_km_xof ?? "",
      });
    }
  }, [data]);

  async function save() {
    const { error } = await supabase
      .from("cargo_config")
      .update({
        china_warehouse_address: form.china_warehouse_address,
        china_warehouse_contact: form.china_warehouse_contact,
        instructions: form.instructions,
        default_rate_per_kg_xof: form.default_rate_per_kg_xof === "" ? null : Number(form.default_rate_per_kg_xof),
        default_rate_per_cbm_xof: form.default_rate_per_cbm_xof === "" ? null : Number(form.default_rate_per_cbm_xof),
        default_customs_flat_fee_xof:
          form.default_customs_flat_fee_xof === "" ? null : Number(form.default_customs_flat_fee_xof),
        local_hub_lat: form.local_hub_lat === "" ? null : Number(form.local_hub_lat),
        local_hub_lng: form.local_hub_lng === "" ? null : Number(form.local_hub_lng),
        delivery_base_fee_xof: form.delivery_base_fee_xof === "" ? null : Number(form.delivery_base_fee_xof),
        delivery_rate_per_km_xof: form.delivery_rate_per_km_xof === "" ? null : Number(form.delivery_rate_per_km_xof),
        updated_at: new Date().toISOString(),
      } as never)
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

        <div className="border-t border-border pt-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tarification fret (Total_Fret = Poids/Volume × Tarif + Frais douane)
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Tarif / kg (Air) — XOF</span>
              <input
                type="number"
                value={form.default_rate_per_kg_xof}
                onChange={(e) => setForm({ ...form, default_rate_per_kg_xof: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Tarif / CBM (Mer) — XOF</span>
              <input
                type="number"
                value={form.default_rate_per_cbm_xof}
                onChange={(e) => setForm({ ...form, default_rate_per_cbm_xof: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-semibold text-muted-foreground">Frais douane fixes — XOF</span>
              <input
                type="number"
                value={form.default_customs_flat_fee_xof}
                onChange={(e) => setForm({ ...form, default_customs_flat_fee_xof: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Hub local Abidjan (GPS dispatch dernier kilomètre)
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Latitude hub</span>
              <input
                type="number"
                step="0.000001"
                value={form.local_hub_lat}
                onChange={(e) => setForm({ ...form, local_hub_lat: e.target.value })}
                placeholder="Ex : 5.320357"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Longitude hub</span>
              <input
                type="number"
                step="0.000001"
                value={form.local_hub_lng}
                onChange={(e) => setForm({ ...form, local_hub_lng: e.target.value })}
                placeholder="Ex : -4.016107"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Frais de base livraison — XOF</span>
              <input
                type="number"
                value={form.delivery_base_fee_xof}
                onChange={(e) => setForm({ ...form, delivery_base_fee_xof: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Tarif / km — XOF</span>
              <input
                type="number"
                value={form.delivery_rate_per_km_xof}
                onChange={(e) => setForm({ ...form, delivery_rate_per_km_xof: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Astuce : trouvez les coordonnées GPS de votre hub sur Google Maps (clic droit sur le point → copier les
            coordonnées).
          </p>
        </div>

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
