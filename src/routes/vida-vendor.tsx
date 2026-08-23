import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Package, ShieldAlert, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useVidaRole } from "@/hooks/use-vida-role";
import { compressAndUploadImage } from "@/lib/image-upload";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/vida-vendor")({
  head: () => ({
    meta: [{ title: "Espace Vendeur — ViDa" }, { name: "robots", content: "noindex" }],
  }),
  component: VidaVendorPortal,
});

const EMPTY = {
  title: "",
  description: "",
  price_xof: "",
  delivery_fee_xof: "1000",
  stock_quantity: "1",
};

function VidaVendorPortal() {
  const { user, loading } = useAuth();
  const { hasRole, isPending, loading: roleLoading } = useVidaRole("vendor");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/vida-vendor" } as never });
  }, [loading, user, navigate]);

  const { data: products } = useQuery({
    queryKey: ["vida-my-products", user?.id],
    enabled: !!user && hasRole,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_products")
        .select("*")
        .eq("vendor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await compressAndUploadImage(file, { prefix: "vida-products" });
      setImageUrl(url);
    } catch (err) {
      toast.error((err as Error).message ?? "Échec du téléversement de l'image.");
    } finally {
      setUploading(false);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connectez-vous.");
      const price = Number(form.price_xof);
      const delivery = Number(form.delivery_fee_xof);
      const qty = Number(form.stock_quantity);
      if (form.title.trim().length < 3) throw new Error("Titre trop court.");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Prix invalide.");
      if (!Number.isFinite(qty) || qty < 1) throw new Error("Quantité invalide.");

      // Insert direct autorisé par RLS ("Vendeur gère ses produits") : les règles
      // sensibles (commissions, fenêtre d'annulation) restent aux valeurs par
      // défaut de la table et ne sont modifiables que par l'admin ensuite.
      const { error } = await supabase.from("vida_products").insert({
        vendor_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: imageUrl,
        price_xof: price,
        delivery_fee_xof: delivery,
        stock_quantity: qty,
        is_active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit ViDa publié.");
      setForm(EMPTY);
      setImageUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["vida-my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (v: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("vida_products")
        .update({ is_active: v.isActive } as never)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vida-my-products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStock = useMutation({
    mutationFn: async (v: { id: string; stock: number }) => {
      const { error } = await supabase
        .from("vida_products")
        .update({ stock_quantity: v.stock } as never)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock mis à jour.");
      qc.invalidateQueries({ queryKey: ["vida-my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || roleLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!hasRole) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-bold">
          {isPending
            ? "Votre compte Vendeur est en attente de validation par l'administration."
            : "Accès réservé aux vendeurs approuvés ViDa."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <h1 className="flex items-center gap-1.5 font-display text-base font-black">
          <Store className="h-4 w-4" /> Espace Vendeur ViDa
        </h1>
        <p className="text-[10px] text-muted-foreground">
          Les commissions et la fenêtre d'annulation sont fixées par l'administration.
        </p>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* Formulaire de publication */}
        <section className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-bold">Publier un nouveau produit</p>
          <div className="mt-2 space-y-2">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titre du produit"
              className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              rows={2}
              className="w-full rounded-lg border border-input bg-background p-2.5 text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.price_xof}
                onChange={(e) => setForm((f) => ({ ...f, price_xof: e.target.value }))}
                type="number"
                placeholder="Prix (FCFA)"
                className="rounded-lg border border-input bg-background p-2.5 text-xs"
              />
              <input
                value={form.delivery_fee_xof}
                onChange={(e) => setForm((f) => ({ ...f, delivery_fee_xof: e.target.value }))}
                type="number"
                placeholder="Frais livraison"
                className="rounded-lg border border-input bg-background p-2.5 text-xs"
              />
              <input
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                type="number"
                placeholder="Stock"
                className="rounded-lg border border-input bg-background p-2.5 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
              <ImagePlus className="h-4 w-4 shrink-0" />
              {uploading ? "Envoi en cours…" : imageUrl ? "Image ajoutée ✓" : "Ajouter une photo"}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || uploading || !form.title || !form.price_xof}
              className="w-full rounded-lg bg-primary py-2.5 text-xs font-black text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Publication…" : "Publier le produit"}
            </button>
          </div>
        </section>

        {/* Mes produits */}
        <section>
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <Package className="h-4 w-4" /> Mes produits ViDa
          </p>
          <ul className="mt-2 space-y-2">
            {(products ?? []).map((p: any) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold">{p.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      p.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.is_active ? "En vente" : "Masqué"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-black text-primary">
                  {formatXOF(Number(p.price_xof))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Commission agent {p.agent_commission_percentage}% · plateforme{" "}
                  {p.platform_commission_percentage}% · annulation {p.cancellation_window_hours}h (
                  {p.cancellation_penalty_percentage}%)
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={p.stock_quantity}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v !== p.stock_quantity)
                        updateStock.mutate({ id: p.id, stock: v });
                    }}
                    className="w-20 rounded-lg border border-input bg-background p-1.5 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">stock</span>
                  <button
                    onClick={() => toggleActive.mutate({ id: p.id, isActive: !p.is_active })}
                    className="ml-auto rounded-lg border border-border px-2 py-1 text-[10px] font-bold"
                  >
                    {p.is_active ? "Masquer" : "Republier"}
                  </button>
                </div>
              </li>
            ))}
            {(products ?? []).length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">
                Aucun produit publié pour l'instant.
              </li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
