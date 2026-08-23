import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { vidaAdminUpdateProductRules } from "@/lib/vida.functions";

export const Route = createFileRoute("/admin/vida-products")({
  head: () => ({
    meta: [
      { title: "ViDa — Règles produits | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaProducts,
});

function AdminVidaProducts() {
  const qc = useQueryClient();
  const updateRules = useServerFn(vidaAdminUpdateProductRules);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-vida-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: (v: {
      productId: string;
      cancellationWindowHours: number;
      cancellationPenaltyPercentage: number;
      agentCommissionPercentage: number;
      platformCommissionPercentage: number;
    }) => updateRules({ data: v }),
    onSuccess: () => {
      toast.success("Règles produit mises à jour.");
      qc.invalidateQueries({ queryKey: ["admin-vida-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-black">ViDa — Règles par produit</h1>
        <p className="text-xs text-muted-foreground">
          Fenêtre d'annulation, pénalité et répartition des commissions, personnalisables pour
          chaque produit.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <ul className="space-y-2">
        {(products ?? []).map((p: any) => (
          <ProductRuleRow
            key={p.id}
            product={p}
            saving={save.isPending}
            onSave={(v) => save.mutate({ productId: p.id, ...v })}
          />
        ))}
      </ul>
    </div>
  );
}

function ProductRuleRow({
  product,
  saving,
  onSave,
}: {
  product: any;
  saving: boolean;
  onSave: (v: {
    cancellationWindowHours: number;
    cancellationPenaltyPercentage: number;
    agentCommissionPercentage: number;
    platformCommissionPercentage: number;
  }) => void;
}) {
  const [window, setWindow] = useState(String(product.cancellation_window_hours));
  const [penalty, setPenalty] = useState(String(product.cancellation_penalty_percentage));
  const [agentPct, setAgentPct] = useState(String(product.agent_commission_percentage));
  const [platformPct, setPlatformPct] = useState(String(product.platform_commission_percentage));

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold">{product.title}</p>
        <p className="text-xs font-black text-primary">{formatXOF(Number(product.price_xof))}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Field label="Fenêtre annulation (h)" value={window} onChange={setWindow} />
        <Field label="Pénalité annulation (%)" value={penalty} onChange={setPenalty} />
        <Field label="Commission agent (%)" value={agentPct} onChange={setAgentPct} />
        <Field label="Commission plateforme (%)" value={platformPct} onChange={setPlatformPct} />
      </div>
      <button
        onClick={() =>
          onSave({
            cancellationWindowHours: Number(window),
            cancellationPenaltyPercentage: Number(penalty),
            agentCommissionPercentage: Number(agentPct),
            platformCommissionPercentage: Number(platformPct),
          })
        }
        disabled={saving}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
      >
        <Save className="h-3 w-3" /> Enregistrer
      </button>
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-[10px] text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
      />
    </label>
  );
}
