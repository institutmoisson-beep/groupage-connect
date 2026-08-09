import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2, Upload, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { compressAndUploadImage } from "@/lib/image-upload";
import {
  OFS_CATEGORIES,
  OFS_CATEGORY_LABELS,
  OFS_PAYMENT_STATUS_LABELS,
  OFS_PRODUCT_STATUS_LABELS,
  OFS_STAGES,
  OFS_STAGE_LABELS,
  type OfsStage,
} from "@/lib/onfaisimple";

export const Route = createFileRoute("/admin/onfaisimple")({
  head: () => ({
    meta: [
      { title: "OnFaiSimple™ — administration | MSN Courtier" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOnFaiSimple,
});

type Tab = "products" | "channels" | "deposits" | "tracking";

function AdminOnFaiSimple() {
  const [tab, setTab] = useState<Tab>("products");
  const tabs: Array<{ k: Tab; label: string }> = [
    { k: "products", label: "Produits" },
    { k: "channels", label: "Moyens de paiement" },
    { k: "deposits", label: "Dépôts & preuves" },
    { k: "tracking", label: "Suivi 7 étapes" },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-black">OnFaiSimple™</h1>
        <p className="text-xs text-muted-foreground">
          Lots de sourcing participatif, canaux d'encaissement, validation des dépôts et suivi de
          cycle.
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === t.k
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsPanel />}
      {tab === "channels" && <ChannelsPanel />}
      {tab === "deposits" && <DepositsPanel />}
      {tab === "tracking" && <TrackingPanel />}
    </div>
  );
}

/* ------------------------------- PRODUITS ------------------------------- */

function ProductsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    category: "electronique",
    description: "",
    unit_cost: "",
    projected_retail_price: "",
    user_profit_share_percent: "60",
    total_units: "",
    min_units_per_order: "1",
    estimated_days: "35",
  });
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-ofs-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("onfaisimple_products").insert({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        unit_cost: Number(form.unit_cost),
        projected_retail_price: Number(form.projected_retail_price),
        user_profit_share_percent: Number(form.user_profit_share_percent),
        total_units: Number(form.total_units),
        min_units_per_order: Number(form.min_units_per_order),
        estimated_days: Number(form.estimated_days),
        images: image ? [image] : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ofs-products"] });
      setForm({ ...form, title: "", description: "", unit_cost: "", projected_retail_price: "", total_units: "" });
      setImage(null);
      toast.success("Lot créé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: { status: "funding" | "closed" | "completed" | "hidden" } }) => {
      const { error } = await supabase
        .from("onfaisimple_products")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ofs-products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onfaisimple_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ofs-products"] });
      toast.success("Lot supprimé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">Nouveau lot</h2>
        <Field label="Titre">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {OFS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {OFS_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            rows={2}
            className={inputCls}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Coût unitaire (FCFA)">
            <input className={inputCls} inputMode="numeric" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </Field>
          <Field label="Revente estimée">
            <input className={inputCls} inputMode="numeric" value={form.projected_retail_price} onChange={(e) => setForm({ ...form, projected_retail_price: e.target.value })} />
          </Field>
          <Field label="Part client (%)">
            <input className={inputCls} inputMode="numeric" value={form.user_profit_share_percent} onChange={(e) => setForm({ ...form, user_profit_share_percent: e.target.value })} />
          </Field>
          <Field label="Unités totales">
            <input className={inputCls} inputMode="numeric" value={form.total_units} onChange={(e) => setForm({ ...form, total_units: e.target.value })} />
          </Field>
          <Field label="Min. / commande">
            <input className={inputCls} inputMode="numeric" value={form.min_units_per_order} onChange={(e) => setForm({ ...form, min_units_per_order: e.target.value })} />
          </Field>
          <Field label="Délai (jours)">
            <input className={inputCls} inputMode="numeric" value={form.estimated_days} onChange={(e) => setForm({ ...form, estimated_days: e.target.value })} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs font-semibold">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {image ? "Image ajoutée ✓" : "Image du produit"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const up = await compressAndUploadImage(f, { prefix: "onfaisimple" });
                setImage(up.url);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Upload échoué");
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        <button
          disabled={!form.title || !form.unit_cost || !form.projected_retail_price || !form.total_units || create.isPending}
          onClick={() => create.mutate()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Créer le lot
        </button>
      </section>

      <section className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {OFS_CATEGORY_LABELS[p.category] ?? p.category} · {formatXOF(p.unit_cost)} →{" "}
                    {formatXOF(p.projected_retail_price)} · part client{" "}
                    {p.user_profit_share_percent}% · {p.estimated_days} j
                  </div>
                  <div className="text-[11px] font-semibold">
                    {p.funded_units}/{p.total_units} unités financées
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.status}
                    onChange={(e) => update.mutate({ id: p.id, patch: { status: e.target.value as "funding" } })}
                    className="rounded-lg border border-input bg-background px-2 py-1 text-[11px]"
                  >
                    {Object.entries(OFS_PRODUCT_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer « ${p.title} » ?`)) remove.mutate(p.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/* ------------------------------- CANAUX -------------------------------- */

const KINDS = [
  { k: "redirect", label: "Lien direct (Wave / OM / MTN)" },
  { k: "manual", label: "Transfert manuel + preuve" },
  { k: "crypto", label: "Crypto USDT" },
] as const;

function ChannelsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    kind: "redirect" as (typeof KINDS)[number]["k"],
    name: "",
    account_identifier: "",
    account_holder: "",
    redirect_url: "",
    crypto_network: "TRC20",
    instructions: "",
    sort_order: "10",
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["admin-ofs-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_payment_channels")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("onfaisimple_payment_channels").insert({
        kind: form.kind,
        name: form.name.trim(),
        account_identifier: form.account_identifier.trim() || null,
        account_holder: form.account_holder.trim() || null,
        redirect_url: form.kind === "redirect" ? form.redirect_url.trim() || null : null,
        crypto_network: form.kind === "crypto" ? form.crypto_network : null,
        instructions: form.instructions.trim() || null,
        sort_order: Number(form.sort_order) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ofs-channels"] });
      setForm({ ...form, name: "", account_identifier: "", redirect_url: "", instructions: "" });
      toast.success("Moyen de paiement ajouté.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: { active: boolean } }) => {
      const { error } = await supabase
        .from("onfaisimple_payment_channels")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ofs-channels"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onfaisimple_payment_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ofs-channels"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">Nouveau moyen d'encaissement</h2>
        <Field label="Type">
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
          >
            {KINDS.map((k) => (
              <option key={k.k} value={k.k}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nom affiché">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={form.kind === "crypto" ? "Adresse du wallet" : "Numéro Mobile Money"}>
          <input className={inputCls} value={form.account_identifier} onChange={(e) => setForm({ ...form, account_identifier: e.target.value })} />
        </Field>
        <Field label="Titulaire">
          <input className={inputCls} value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
        </Field>
        {form.kind === "redirect" && (
          <Field label="Lien de paiement">
            <input className={inputCls} value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })} />
          </Field>
        )}
        {form.kind === "crypto" && (
          <Field label="Réseau">
            <select
              className={inputCls}
              value={form.crypto_network}
              onChange={(e) => setForm({ ...form, crypto_network: e.target.value })}
            >
              <option value="TRC20">TRC20</option>
              <option value="BEP20">BEP20</option>
            </select>
          </Field>
        )}
        <Field label="Consignes">
          <textarea rows={2} className={inputCls} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </Field>
        <Field label="Ordre d'affichage">
          <input className={inputCls} inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
        </Field>
        <button
          disabled={!form.name || create.isPending}
          onClick={() => create.mutate()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </section>

      <section className="space-y-2">
        {channels.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="text-sm font-bold">
                {c.name}{" "}
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.kind}
                  {c.crypto_network ? ` · ${c.crypto_network}` : ""}
                </span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {c.account_identifier} {c.redirect_url ? `· ${c.redirect_url}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => update.mutate({ id: c.id, patch: { active: !c.active } })}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                  c.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                {c.active ? "Actif" : "Inactif"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Supprimer « ${c.name} » ?`)) remove.mutate(c.id);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------- DEPOTS -------------------------------- */

function useAdminOrders() {
  return useQuery({
    queryKey: ["admin-ofs-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onfaisimple_orders")
        .select("*, onfaisimple_products(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function DepositsPanel() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useAdminOrders();
  const [note, setNote] = useState<Record<string, string>>({});

  const review = useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject" }) => {
      const { error } = await supabase.rpc("onfaisimple_review_payment", {
        p_order_id: input.id,
        p_action: input.action,
        p_note: note[input.id] || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ofs-orders"] });
      toast.success("Dépôt traité.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = orders.filter((o) => o.payment_status === "pending");

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun dépôt en attente de vérification.</p>
      ) : (
        pending.map((o) => {
          const p = o.onfaisimple_products as { title: string } | null;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{p?.title ?? "Lot"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.contract_reference} · {o.units_count} u. ·{" "}
                    {formatXOF(Number(o.total_amount))}
                  </div>
                  <div className="text-[11px]">
                    {o.payment_method} {o.payment_channel_label ? `· ${o.payment_channel_label}` : ""}{" "}
                    {o.payment_reference ? `· réf ${o.payment_reference}` : ""}
                  </div>
                  {o.payment_proof_url && (
                    <a
                      href={o.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-primary underline"
                    >
                      Voir la preuve
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <input
                    value={note[o.id] ?? ""}
                    onChange={(e) => setNote({ ...note, [o.id]: e.target.value })}
                    placeholder="Note admin"
                    className="rounded-lg border border-input bg-background px-2 py-1 text-[11px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review.mutate({ id: o.id, action: "approve" })}
                      className="flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-[11px] font-bold text-success-foreground"
                    >
                      <Check className="h-3.5 w-3.5" /> Valider
                    </button>
                    <button
                      onClick={() => review.mutate({ id: o.id, action: "reject" })}
                      className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-bold text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" /> Refuser
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------- SUIVI --------------------------------- */

function TrackingPanel() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useAdminOrders();
  const [draft, setDraft] = useState<
    Record<string, { stage: OfsStage; note: string; tracking: string; photo: string }>
  >({});

  const setStage = useMutation({
    mutationFn: async (id: string) => {
      const d = draft[id];
      if (!d) throw new Error("Choisissez une étape.");
      const { error } = await supabase.rpc("onfaisimple_set_stage", {
        p_order_id: id,
        p_stage: d.stage,
        p_note: d.note || undefined,
        p_photo_url: d.photo || undefined,
        p_tracking_code: d.tracking || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ofs-orders"] });
      toast.success("Étape mise à jour.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = orders.filter((o) => o.payment_status === "approved");

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : active.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun mandat validé à suivre.</p>
      ) : (
        active.map((o) => {
          const p = o.onfaisimple_products as { title: string } | null;
          const d =
            draft[o.id] ?? {
              stage: o.current_stage as OfsStage,
              note: "",
              tracking: o.cargo_tracking_code ?? "",
              photo: "",
            };
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">{p?.title ?? "Lot"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.contract_reference} · {o.units_count} u. ·{" "}
                    {formatXOF(Number(o.expected_payout))} attendus ·{" "}
                    {OFS_STAGE_LABELS[o.current_stage as OfsStage]}
                    {o.payout_credited_at ? " · gain crédité" : ""}
                  </div>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold">
                  {OFS_PAYMENT_STATUS_LABELS[o.payment_status]}
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <select
                  className={inputCls}
                  value={d.stage}
                  onChange={(e) => setDraft({ ...draft, [o.id]: { ...d, stage: e.target.value as OfsStage } })}
                >
                  {OFS_STAGES.map((s, i) => (
                    <option key={s} value={s}>
                      {i + 1}. {OFS_STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  placeholder="Note / unités vendues"
                  value={d.note}
                  onChange={(e) => setDraft({ ...draft, [o.id]: { ...d, note: e.target.value } })}
                />
                <input
                  className={inputCls}
                  placeholder="Code conteneur / suivi cargo"
                  value={d.tracking}
                  onChange={(e) => setDraft({ ...draft, [o.id]: { ...d, tracking: e.target.value } })}
                />
                <div className="flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] font-semibold">
                    <Upload className="h-3.5 w-3.5" /> {d.photo ? "Photo ✓" : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const up = await compressAndUploadImage(f, { prefix: "onfaisimple-stages" });
                          setDraft({ ...draft, [o.id]: { ...d, photo: up.url } });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Upload échoué");
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => setStage.mutate(o.id)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                  >
                    Mettre à jour
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------- UI utils ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
