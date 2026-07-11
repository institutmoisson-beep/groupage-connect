import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/campaign-products")({
  component: AdminCampaignProducts,
});

function AdminCampaignProducts() {
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = useState("");
  const [productId, setProductId] = useState("");

  const { data: links } = useQuery({
    queryKey: ["admin-cp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_products")
        .select("*, groupage_campaigns(title, shipping_type), products(title, category)");
      if (error) throw error;
      return data;
    },
  });
  const { data: campaigns } = useQuery({
    queryKey: ["admin-campaigns-select"],
    queryFn: async () => (await supabase.from("groupage_campaigns").select("id, title, shipping_type")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["admin-products-select"],
    queryFn: async () => (await supabase.from("products").select("id, title, category")).data ?? [],
  });

  async function add() {
    if (!campaignId || !productId) return toast.error("Sélection incomplète");
    const { error } = await supabase.from("campaign_products").insert({ campaign_id: campaignId, product_id: productId });
    if (error) toast.error(error.message);
    else {
      toast.success("Ajouté");
      qc.invalidateQueries({ queryKey: ["admin-cp"] });
    }
  }

  async function remove(campaign_id: string, product_id: string) {
    if (!confirm("Retirer ce produit de la campagne ?")) return;
    const { error } = await supabase.from("campaign_products").delete().match({ campaign_id, product_id });
    if (error) toast.error(error.message);
    else {
      toast.success("Retiré");
      qc.invalidateQueries({ queryKey: ["admin-cp"] });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-black">Produits liés aux campagnes</h1>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-2 text-xs md:grid-cols-[1fr_1fr_auto]">
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
            <option value="">— Campagne —</option>
            {(campaigns ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                [{c.shipping_type}] {c.title}
              </option>
            ))}
          </select>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
            <option value="">— Produit —</option>
            {(products ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.category})
              </option>
            ))}
          </select>
          <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 font-bold text-primary-foreground shadow-brand">
            <Plus className="h-3.5 w-3.5" /> Lier
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Campagne</th>
              <th className="p-2">Type</th>
              <th className="p-2">Produit</th>
              <th className="p-2">Catégorie</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(links ?? []).map((l: any) => (
              <tr key={`${l.campaign_id}-${l.product_id}`} className="border-b border-border">
                <td className="p-2">{l.groupage_campaigns?.title}</td>
                <td className="p-2 uppercase">{l.groupage_campaigns?.shipping_type}</td>
                <td className="p-2">{l.products?.title}</td>
                <td className="p-2">{l.products?.category}</td>
                <td className="p-2 text-right">
                  <button onClick={() => remove(l.campaign_id, l.product_id)} className="rounded bg-destructive p-1.5 text-destructive-foreground">
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
