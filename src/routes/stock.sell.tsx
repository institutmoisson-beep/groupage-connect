import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, PackagePlus, Trash2 } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { compressAndUploadImage } from "@/lib/image-upload";
import { formatXOF } from "@/lib/format";
import { CATEGORY_LABELS, PRODUCT_STATUS_LABELS, STOCK_CATEGORIES } from "@/lib/stock";

const sellSearchSchema = z.object({
  container: z.string().trim().max(100).optional(),
  title: z.string().trim().max(150).optional(),
});

export const Route = createFileRoute("/stock/sell")({
  validateSearch: (s: Record<string, unknown>) => sellSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Mettre du stock en vente — MSN Stock Express" },
      {
        name: "description",
        content:
          "Importateurs MSN Cargo : publiez le stock de vos conteneurs dédouanés et laissez un réseau de revendeurs le vendre pour vous.",
      },
      { property: "og:title", content: "Mettre du stock en vente — MSN Stock Express" },
      { property: "og:description", content: "Publiez vos marchandises importées et vendez plus vite grâce aux revendeurs MSN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SellStock,
});

const EMPTY = {
  title: "",
  category: "general",
  description: "",
  container_tracking_number: "",
  wholesale_price: "",
  suggested_price: "",
  commission_amount: "",
  stock_quantity: "",
  storage_location: "Entrepôt MSN Abidjan - Zone 4",
  media_kit_text: "",
};

function SellStock() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { container, title } = Route.useSearch();
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    container_tracking_number: container ?? EMPTY.container_tracking_number,
    title: title ?? EMPTY.title,
  }));
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["stock-my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_express_products")
        .select("*")
        .eq("importer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connectez-vous.");
      const wholesale = Number(form.wholesale_price);
      const suggested = Number(form.suggested_price);
      const commission = Number(form.commission_amount);
      const qty = Number(form.stock_quantity);
      if (form.title.trim().length < 3) throw new Error("Titre trop court.");
      if (!Number.isFinite(wholesale) || wholesale <= 0) throw new Error("Prix grossiste invalide.");
      if (!Number.isFinite(suggested) || suggested < wholesale)
        throw new Error("Le prix conseillé doit être supérieur au prix grossiste.");
      if (!Number.isFinite(commission) || commission <= 0) throw new Error("Commission invalide.");
      if (commission > suggested - wholesale)
        throw new Error("La commission ne peut pas dépasser la marge (conseillé − grossiste).");
      if (!Number.isFinite(qty) || qty < 1) throw new Error("Quantité en stock invalide.");
      if (images.length === 0) throw new Error("Ajoutez au moins une photo du produit.");

      const { error } = await supabase.from("stock_express_products").insert({
        importer_id: user.id,
        title: form.title.trim().slice(0, 150),
        category: form.category,
        description: form.description.trim().slice(0, 2000) || null,
        container_tracking_number: form.container_tracking_number.trim().slice(0, 100) || null,
        wholesale_price: wholesale,
        suggested_price: suggested,
        commission_amount: commission,
        stock_quantity: qty,
        storage_location: form.storage_location.trim().slice(0, 200) || null,
        media_kit_text: form.media_kit_text.trim().slice(0, 2000) || null,
        images,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock soumis — validation par la logistique MSN en cours.");
      setForm(EMPTY);
      setImages([]);
      qc.invalidateQueries({ queryKey: ["stock-my-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith("image/")) continue;
        const { url } = await compressAndUploadImage(file, { prefix: "stock-express" });
        uploaded.push(url);
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 8));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi des photos");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <h1 className="font-display text-lg font-black">Mettre du stock en vente</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Publiez la marchandise de vos conteneurs dédouanés sur MSN Stock Express. Des revendeurs
          la vendent localement, MSN livre et encaisse, votre part est créditée automatiquement.
        </p>
        {container && (
          <p className="mt-2 rounded-lg bg-primary/10 px-2 py-1.5 text-[11px] font-semibold text-primary">
            Colis lié : {container}
          </p>
        )}

        {!user ? (
          <Link to="/auth" className="mt-4 inline-block rounded-lg bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground">
            Se connecter
          </Link>
        ) : (
          <section className="mt-4 space-y-2 rounded-xl border border-border bg-card p-3">
            <Text label="Nom du produit" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <label className="block">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Catégorie</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              >
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Description</span>
              <textarea
                value={form.description}
                maxLength={2000}
                rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </label>
            <Text
              label="N° de conteneur / tracking MSN (optionnel)"
              value={form.container_tracking_number}
              onChange={(v) => setForm({ ...form, container_tracking_number: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Num label="Prix grossiste (FCFA)" value={form.wholesale_price} onChange={(v) => setForm({ ...form, wholesale_price: v })} />
              <Num label="Prix conseillé (FCFA)" value={form.suggested_price} onChange={(v) => setForm({ ...form, suggested_price: v })} />
              <Num label="Commission / unité" value={form.commission_amount} onChange={(v) => setForm({ ...form, commission_amount: v })} />
              <Num label="Quantité en stock" value={form.stock_quantity} onChange={(v) => setForm({ ...form, stock_quantity: v })} />
            </div>
            <Text label="Lieu de stockage" value={form.storage_location} onChange={(v) => setForm({ ...form, storage_location: v })} />
            <label className="block">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Texte marketing du pack média (optionnel)
              </span>
              <textarea
                value={form.media_kit_text}
                maxLength={2000}
                rows={3}
                onChange={(e) => setForm({ ...form, media_kit_text: e.target.value })}
                placeholder="Laissez vide : MSN génère un texte prêt à publier."
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </label>

            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Photos / visuels</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {images.map((src) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setImages((p) => p.filter((x) => x !== src))}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                      aria-label="Retirer la photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                </label>
              </div>
              {uploading && <p className="mt-1 text-[11px] text-muted-foreground">Optimisation des images…</p>}
            </div>

            <button
              disabled={create.isPending || uploading}
              onClick={() => create.mutate()}
              className="mt-2 w-full rounded-xl bg-gradient-brand py-3 text-sm font-black text-primary-foreground shadow-brand disabled:opacity-60"
            >
              <PackagePlus className="mr-1 inline h-4 w-4" />
              {create.isPending ? "Envoi…" : "Mettre en vente sur MSN Express"}
            </button>
          </section>
        )}

        {mine && mine.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-bold">Mes annonces</h2>
            <ul className="mt-2 space-y-2">
              {mine.map((p) => (
                <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">{p.title}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Grossiste {formatXOF(Number(p.wholesale_price))} · Commission{" "}
                    {formatXOF(Number(p.commission_amount))} · {p.stock_quantity} en stock
                  </p>
                  {p.admin_notes && <p className="mt-1 text-[11px] text-destructive">{p.admin_notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <input
        value={value}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
      />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
      />
    </label>
  );
}
