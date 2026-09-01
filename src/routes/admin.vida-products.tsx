import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Boxes,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF, computePrice } from "@/lib/format";
import { compressAndUploadImage } from "@/lib/image-upload";
import {
  vidaAdminUpdateProductRules,
  vidaAdminCreateProduct,
  vidaAdminUpdateProduct,
  vidaAdminSetProductActive,
} from "@/lib/vida.functions";
import { adminListUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/vida-products")({
  head: () => ({
    meta: [
      { title: "ViDa — Produits | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaProducts,
});

// Un article sélectionné pour composer un produit ViDa simple ou un pack.
type DraftItem = {
  productId: string | null;
  title: string;
  quantity: number;
  unitPriceXof: number;
  imageUrl?: string | null;
};

function AdminVidaProducts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const updateRules = useServerFn(vidaAdminUpdateProductRules);
  const createProduct = useServerFn(vidaAdminCreateProduct);
  const updateProduct = useServerFn(vidaAdminUpdateProduct);
  const setActive = useServerFn(vidaAdminSetProductActive);

  const [showCreate, setShowCreate] = useState(false);

  // ---- Comptes "Vendeur" ViDa approuvés — un produit doit obligatoirement leur appartenir ----
  // ---- Comptes pouvant porter un produit ViDa : vendeurs ViDa approuvés + tous les comptes ----
  const listUsers = useServerFn(adminListUsers);
  const { data: vendors } = useQuery({
    queryKey: ["admin-vida-vendor-candidates"],
    queryFn: async () => {
      const users = await listUsers({ data: undefined });
      const { data: roles } = await supabase
        .from("vida_roles")
        .select("user_id")
        .eq("role", "vendor")
        .eq("is_approved", true)
        .eq("is_suspended", false);
      const vendorIds = new Set((roles ?? []).map((r: any) => r.user_id));
      return users
        .map((u) => ({
          id: u.id,
          label: `${u.fullName ?? u.email ?? u.id}${vendorIds.has(u.id) ? " · vendeur ViDa" : ""}`,
          isVendor: vendorIds.has(u.id),
        }))
        .sort((a, b) => Number(b.isVendor) - Number(a.isVendor));
    },
  });


  // ---- Produits ViDa déjà créés (avec le contenu de leur pack, s'il y en a un) ----
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-vida-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_products")
        .select("*, vida_product_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ---- Catalogue existant (table "products") dans lequel piocher pour créer un pack ----
  const { data: catalog } = useQuery({
    queryKey: ["admin-vida-catalog-source"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, image_urls, cny_price, exchange_rate_cny_xof, logistics_fee_xof, category")
        .eq("active", true)
        .order("title", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  type CreateProductInput = {
    title: string;
    description: string;
    imageUrl: string | null;
    priceXof: number;
    deliveryFeeXof: number;
    stockQuantity: number;
    isActive: boolean;
    cancellationWindowHours: number;
    cancellationPenaltyPercentage: number;
    agentCommissionPercentage: number;
    platformCommissionPercentage: number;
    items: { productId: string | null; title: string; quantity: number; unitPriceXof: number }[];
  };

  type UpdateProductInput = {
    productId: string;
    title: string;
    description: string;
    imageUrl: string | null;
    priceXof: number;
    deliveryFeeXof: number;
    stockQuantity: number;
    isActive: boolean;
  };

  const create = useMutation({
    mutationFn: (v: CreateProductInput) => createProduct({ data: v }),
    onSuccess: () => {
      toast.success("Produit ViDa créé — visible dans la section ViDa des utilisateurs.");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["admin-vida-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (v: UpdateProductInput) => updateProduct({ data: v }),
    onSuccess: () => {
      toast.success("Produit ViDa mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-vida-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { productId: string; isActive: boolean }) => setActive({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-vida-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRules = useMutation({
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-black">ViDa — Produits</h1>
          <p className="text-xs text-muted-foreground">
            Créez un article seul ou un pack composé de plusieurs produits déjà existants ;
            réglez ensuite l'annulation et les commissions par produit.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-primary-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau produit ViDa
        </button>
      </div>

      {showCreate && (
        <CreateProductPanel
          catalog={catalog ?? []}
          vendors={vendors ?? []}
          currentUserId={user?.id ?? null}
          saving={create.isPending}
          onCreate={(v) => create.mutate(v)}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <ul className="space-y-2">
        {(products ?? []).map((p: any) => (
          <ProductRow
            key={p.id}
            product={p}
            catalog={catalog ?? []}
            vendors={vendors ?? []}
            savingBase={save.isPending}
            savingRules={saveRules.isPending}
            togglingActive={toggleActive.isPending}
            onSaveBase={(v) => save.mutate({ productId: p.id, ...v })}
            onSaveRules={(v) => saveRules.mutate({ productId: p.id, ...v })}
            onToggleActive={(isActive) => toggleActive.mutate({ productId: p.id, isActive })}
          />
        ))}
        {!isLoading && (products ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Aucun produit ViDa pour l'instant — cliquez sur « Nouveau produit ViDa » pour en créer un.
          </p>
        )}
      </ul>
    </div>
  );
}

// ============================================================================
// Panneau de création
// ============================================================================

function CreateProductPanel({
  catalog,
  vendors,
  currentUserId,
  saving,
  onCreate,
}: {
  catalog: any[];
  vendors: { id: string; label: string }[];
  currentUserId: string | null;
  saving: boolean;
  onCreate: (v: {
    title: string;
    description: string;
    imageUrl: string | null;
    priceXof: number;
    deliveryFeeXof: number;
    stockQuantity: number;
    isActive: boolean;
    cancellationWindowHours: number;
    cancellationPenaltyPercentage: number;
    agentCommissionPercentage: number;
    platformCommissionPercentage: number;
    vendorId: string;
    items: { productId: string | null; title: string; quantity: number; unitPriceXof: number }[];
  }) => void;
}) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priceXof, setPriceXof] = useState("0");
  const [deliveryFeeXof, setDeliveryFeeXof] = useState("1000");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [isActive, setIsActive] = useState(true);
  const [windowH, setWindowH] = useState("24");
  const [penalty, setPenalty] = useState("10");
  const [agentPct, setAgentPct] = useState("5");
  const [platformPct, setPlatformPct] = useState("10");

  const itemsTotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPriceXof * it.quantity, 0),
    [items],
  );

  function addFromCatalog(row: any) {
    if (items.some((it) => it.productId === row.id)) return;
    const price = computePrice({
      cny_price: Number(row.cny_price),
      exchange_rate_cny_xof: Number(row.exchange_rate_cny_xof),
      logistics_fee_xof: Number(row.logistics_fee_xof),
    });
    setItems((prev) => [
      ...prev,
      {
        productId: row.id,
        title: row.title,
        quantity: 1,
        unitPriceXof: price,
        imageUrl: row.image_urls?.[0] ?? null,
      },
    ]);
  }

  function removeItem(productId: string | null, idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItemQty(idx: number, qty: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, qty) } : it)));
  }

  function updateItemPrice(idx: number, price: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitPriceXof: Math.max(0, price) } : it)));
  }

  /** Pré-remplit titre / prix / image à partir de la sélection actuelle — n'écrase rien
   * si vous éditez ensuite les champs à la main. */
  function prefillFromSelection() {
    if (items.length === 0) return;
    setTitle(items.map((it) => it.title).join(" + "));
    setPriceXof(String(itemsTotal));
    if (!imageUrl && items[0]?.imageUrl) setImageUrl(items[0].imageUrl);
  }

  async function handleCreate() {
    if (!title.trim()) return toast.error("Le titre est obligatoire.");
    if (Number(priceXof) <= 0) return toast.error("Le prix de vente doit être supérieur à 0.");
    if (!vendorId) return toast.error("Choisissez le vendeur propriétaire de ce produit.");
    onCreate({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim() || null,
      priceXof: Number(priceXof),
      deliveryFeeXof: Number(deliveryFeeXof),
      stockQuantity: Number(stockQuantity),
      isActive,
      cancellationWindowHours: Number(windowH),
      cancellationPenaltyPercentage: Number(penalty),
      agentCommissionPercentage: Number(agentPct),
      platformCommissionPercentage: Number(platformPct),
      vendorId,
      items: items.map((it) => ({
        productId: it.productId,
        title: it.title,
        quantity: it.quantity,
        unitPriceXof: it.unitPriceXof,
      })),
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <p className="text-xs font-black">
          1. Choisissez un ou plusieurs produits déjà existants (optionnel)
        </p>
        <p className="text-[10px] text-muted-foreground">
          Sélectionnez un seul produit pour créer un article ViDa simple, ou plusieurs pour
          créer un pack. Vous pouvez aussi laisser cette étape vide et remplir le formulaire
          manuellement plus bas.
        </p>
        <CatalogPicker catalog={catalog} selectedIds={items.map((i) => i.productId)} onPick={addFromCatalog} />
      </div>

      {items.length > 0 && (
        <div>
          <p className="text-xs font-black">Articles sélectionnés ({items.length})</p>
          <ul className="mt-1.5 space-y-1.5">
            {items.map((it, idx) => (
              <li
                key={`${it.productId ?? "custom"}-${idx}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                {it.imageUrl && (
                  <img src={it.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                )}
                <span className="flex-1 text-[11px] font-bold">{it.title}</span>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  Qté
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                    className="w-14 rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  Prix unit. XOF
                  <input
                    type="number"
                    min={0}
                    value={it.unitPriceXof}
                    onChange={(e) => updateItemPrice(idx, Number(e.target.value))}
                    className="w-24 rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                  />
                </label>
                <button
                  onClick={() => removeItem(it.productId, idx)}
                  className="rounded bg-destructive/90 p-1.5 text-destructive-foreground"
                  aria-label="Retirer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] font-bold text-muted-foreground">
              Total des articles sélectionnés : <span className="text-primary">{formatXOF(itemsTotal)}</span>
            </p>
            <button
              onClick={prefillFromSelection}
              className="rounded-lg border border-primary/40 bg-background px-2.5 py-1.5 text-[10px] font-bold text-primary"
            >
              Préremplir titre / prix / image ci-dessous
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-black">2. Fiche du produit ViDa</p>
        <div className="mt-1.5 grid gap-2 md:grid-cols-2">
          <Input label="Titre" value={title} onChange={setTitle} />
          <Input
            label="Prix de vente ViDa (XOF)"
            type="number"
            value={priceXof}
            onChange={setPriceXof}
          />
          <TextArea label="Description" value={description} onChange={setDescription} />
          <ImageField value={imageUrl} onChange={setImageUrl} />
          <Input
            label="Frais de livraison (XOF)"
            type="number"
            value={deliveryFeeXof}
            onChange={setDeliveryFeeXof}
          />
          <Input label="Stock" type="number" value={stockQuantity} onChange={setStockQuantity} />
          <label className="block text-[10px] text-muted-foreground">
            Vendeur (propriétaire du produit)
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground"
            >
              <option value="">— Choisir —</option>
              {currentUserId && (
                <option value={currentUserId}>Mon compte administrateur (plateforme)</option>
              )}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Tous les comptes sont listés ; les vendeurs ViDa approuvés apparaissent en premier.
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Visible immédiatement dans la section ViDa
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-black">3. Règles ViDa (modifiables plus tard)</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input label="Fenêtre annulation (h)" type="number" value={windowH} onChange={setWindowH} />
          <Input label="Pénalité annulation (%)" type="number" value={penalty} onChange={setPenalty} />
          <Input label="Commission agent (%)" type="number" value={agentPct} onChange={setAgentPct} />
          <Input
            label="Commission plateforme (%)"
            type="number"
            value={platformPct}
            onChange={setPlatformPct}
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Créer le produit ViDa
      </button>
    </div>
  );
}

function CatalogPicker({
  catalog,
  selectedIds,
  onPick,
}: {
  catalog: any[];
  selectedIds: (string | null)[];
  onPick: (row: any) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog.slice(0, 20);
    return catalog.filter((p) => `${p.title} ${p.category ?? ""}`.toLowerCase().includes(needle)).slice(0, 20);
  }, [catalog, q]);

  return (
    <div className="mt-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit du catalogue…"
          className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-xs outline-none focus:border-primary"
        />
      </div>
      <div className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-1.5">
        {filtered.map((row) => {
          const already = selectedIds.includes(row.id);
          const price = computePrice({
            cny_price: Number(row.cny_price),
            exchange_rate_cny_xof: Number(row.exchange_rate_cny_xof),
            logistics_fee_xof: Number(row.logistics_fee_xof),
          });
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick(row)}
              disabled={already}
              className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-[11px] ${
                already ? "opacity-40" : "hover:bg-muted"
              }`}
            >
              {row.image_urls?.[0] && (
                <img src={row.image_urls[0]} alt="" className="h-7 w-7 rounded object-cover" />
              )}
              <span className="flex-1 font-bold">{row.title}</span>
              <span className="text-muted-foreground">{formatXOF(price)}</span>
              {already ? <Boxes className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-2 text-center text-[10px] text-muted-foreground">Aucun produit trouvé.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Ligne produit existant (édition + règles + activation)
// ============================================================================

function ProductRow({
  product,
  catalog,
  vendors,
  savingBase,
  savingRules,
  togglingActive,
  onSaveBase,
  onSaveRules,
  onToggleActive,
}: {
  product: any;
  catalog: any[];
  vendors: { id: string; label: string }[];
  savingBase: boolean;
  savingRules: boolean;
  togglingActive: boolean;
  onSaveBase: (v: {
    title: string;
    description: string;
    imageUrl: string | null;
    priceXof: number;
    deliveryFeeXof: number;
    stockQuantity: number;
    isActive: boolean;
    vendorId?: string;
  }) => void;
  onSaveRules: (v: {
    cancellationWindowHours: number;
    cancellationPenaltyPercentage: number;
    agentCommissionPercentage: number;
    platformCommissionPercentage: number;
  }) => void;
  onToggleActive: (isActive: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = product.vida_product_items ?? [];
  const isPack = items.length > 1;

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {product.image_url && (
            <img src={product.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
          )}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {isPack && <Boxes className="h-3.5 w-3.5 text-secondary" />}
              {product.title}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatXOF(Number(product.price_xof))} · Stock {product.stock_quantity}
              {isPack ? ` · Pack de ${items.length} articles` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleActive(!product.is_active)}
            disabled={togglingActive}
            title={product.is_active ? "Désactiver (masquer côté utilisateur)" : "Activer (afficher côté utilisateur)"}
            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold disabled:opacity-50 ${
              product.is_active
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {product.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {product.is_active ? "Actif" : "Masqué"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-border p-1.5"
            aria-label="Détails"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground">Contenu du pack</p>
              <ul className="mt-1 space-y-1">
                {items.map((it: any) => (
                  <li key={it.id} className="flex justify-between text-[11px]">
                    <span>
                      {it.quantity}× {it.title_snapshot}
                    </span>
                    <span className="text-muted-foreground">{formatXOF(Number(it.unit_price_xof))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <BaseFieldsForm
            product={product}
            vendors={vendors}
            saving={savingBase}
            onSave={onSaveBase}
          />
          <ProductRuleFields product={product} saving={savingRules} onSave={onSaveRules} />
        </div>
      )}
    </li>
  );
}

function BaseFieldsForm({
  product,
  vendors,
  saving,
  onSave,
}: {
  product: any;
  vendors: { id: string; label: string }[];
  saving: boolean;
  onSave: (v: {
    title: string;
    description: string;
    imageUrl: string | null;
    priceXof: number;
    deliveryFeeXof: number;
    stockQuantity: number;
    isActive: boolean;
    vendorId?: string;
  }) => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [priceXof, setPriceXof] = useState(String(product.price_xof));
  const [deliveryFeeXof, setDeliveryFeeXof] = useState(String(product.delivery_fee_xof ?? 0));
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity));
  const [vendorId, setVendorId] = useState(product.vendor_id ?? "");

  return (
    <div>
      <p className="text-[10px] font-black text-muted-foreground">Informations produit</p>
      <div className="mt-1.5 grid gap-2 md:grid-cols-2">
        <Input label="Titre" value={title} onChange={setTitle} />
        <Input label="Prix de vente (XOF)" type="number" value={priceXof} onChange={setPriceXof} />
        <TextArea label="Description" value={description} onChange={setDescription} />
        <ImageField value={imageUrl} onChange={setImageUrl} />
        <Input
          label="Frais de livraison (XOF)"
          type="number"
          value={deliveryFeeXof}
          onChange={setDeliveryFeeXof}
        />
        <Input label="Stock" type="number" value={stockQuantity} onChange={setStockQuantity} />
        <label className="block text-[10px] text-muted-foreground">
          Vendeur (propriétaire du produit)
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground"
          >
            {!vendors.some((v) => v.id === vendorId) && vendorId && (
              <option value={vendorId}>Vendeur actuel ({vendorId.slice(0, 8)}…)</option>
            )}
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        onClick={() =>
          onSave({
            title,
            description,
            imageUrl: imageUrl || null,
            priceXof: Number(priceXof),
            deliveryFeeXof: Number(deliveryFeeXof),
            stockQuantity: Number(stockQuantity),
            isActive: product.is_active,
            vendorId: vendorId || undefined,
          })
        }
        disabled={saving}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
      >
        <Save className="h-3 w-3" /> Enregistrer les infos produit
      </button>
    </div>
  );
}

function ProductRuleFields({
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
  const [windowH, setWindow] = useState(String(product.cancellation_window_hours));
  const [penalty, setPenalty] = useState(String(product.cancellation_penalty_percentage));
  const [agentPct, setAgentPct] = useState(String(product.agent_commission_percentage));
  const [platformPct, setPlatformPct] = useState(String(product.platform_commission_percentage));

  return (
    <div>
      <p className="text-[10px] font-black text-muted-foreground">
        Règles d'annulation et de commissions
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Input label="Fenêtre annulation (h)" type="number" value={windowH} onChange={setWindow} />
        <Input label="Pénalité annulation (%)" type="number" value={penalty} onChange={setPenalty} />
        <Input label="Commission agent (%)" type="number" value={agentPct} onChange={setAgentPct} />
        <Input
          label="Commission plateforme (%)"
          type="number"
          value={platformPct}
          onChange={setPlatformPct}
        />
      </div>
      <button
        onClick={() =>
          onSave({
            cancellationWindowHours: Number(windowH),
            cancellationPenaltyPercentage: Number(penalty),
            agentCommissionPercentage: Number(agentPct),
            platformCommissionPercentage: Number(platformPct),
          })
        }
        disabled={saving}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground disabled:opacity-50"
      >
        <Save className="h-3 w-3" /> Enregistrer les règles
      </button>
    </div>
  );
}

// ============================================================================
// Champs réutilisables
// ============================================================================

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-[10px] text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[10px] text-muted-foreground md:col-span-2">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground"
      />
    </label>
  );
}

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await compressAndUploadImage(file, { prefix: "vida-products" });
      onChange(url);
      toast.success("Image ajoutée.");
    } catch (e) {
      toast.error(`Échec upload: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-[10px] text-muted-foreground">Image du produit</span>
      <div className="flex items-center gap-2">
        {value && <img src={value} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "…" : "Téléverser"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…ou collez une URL d'image"
        className="mt-1.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
      />
    </div>
  );
}
