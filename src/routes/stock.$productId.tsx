import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, MapPin, Share2, TrendingUp } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { CATEGORY_LABELS, buildMediaKitText, whatsappLink } from "@/lib/stock";

export const Route = createFileRoute("/stock/$productId")({
  head: () => ({
    meta: [
      { title: "Produit à revendre — MSN Stock Express" },
      {
        name: "description",
        content: "Fiche produit de déstockage : prix grossiste, commission garantie, pack média et prise de commande client.",
      },
      { property: "og:title", content: "Produit à revendre — MSN Stock Express" },
      { property: "og:description", content: "Commission garantie par vente, livraison et encaissement gérés par MSN Cargo." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockProductDetail,
});

function StockProductDetail() {
  const { productId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_phone_2: "",
    city_district: "",
    delivery_address: "",
    delivery_date: "",
    quantity: 1,
    final_price: "",
    payment_on_delivery: true,
  });


  const { data: product, isLoading } = useQuery({
    queryKey: ["stock-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_express_products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connectez-vous pour enregistrer une commande.");
      if (!product) throw new Error("Produit indisponible.");
      const finalPrice = Number(form.final_price);
      if (!form.client_name.trim() || form.client_name.trim().length < 2)
        throw new Error("Nom du client requis.");
      if (form.client_phone.replace(/\D/g, "").length < 8)
        throw new Error("Numéro de téléphone client invalide.");
      if (!form.city_district.trim()) throw new Error("Quartier de livraison requis.");
      if (!form.delivery_address.trim()) throw new Error("Adresse de livraison requise.");
      if (!Number.isFinite(finalPrice) || finalPrice < Number(product.wholesale_price))
        throw new Error("Le prix de vente doit être au moins égal au prix grossiste.");
      if (form.quantity < 1 || form.quantity > product.stock_quantity)
        throw new Error(`Quantité indisponible (max ${product.stock_quantity}).`);

      const { error } = await supabase.from("stock_express_orders").insert({
        product_id: product.id,
        reseller_id: user.id,
        client_name: form.client_name.trim().slice(0, 100),
        client_phone: form.client_phone.trim().slice(0, 30),
        client_phone_alt: form.client_phone_2.trim().slice(0, 30) || null,
        city_district: form.city_district.trim().slice(0, 100),
        delivery_address: form.delivery_address.trim().slice(0, 500),
        delivery_date: form.delivery_date || null,
        quantity: form.quantity,
        final_price: finalPrice,
        wholesale_total: Number(product.wholesale_price) * form.quantity,
        commission_earned: Number(product.commission_amount) * form.quantity,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commande envoyée à la logistique MSN ✅");
      qc.invalidateQueries({ queryKey: ["stock-orders"] });
      navigate({ to: "/stock/orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <p className="flex-1 p-6 text-center text-sm text-muted-foreground">Chargement…</p>
        <BottomNav />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="flex-1 p-6 text-center text-sm">
          <p className="font-semibold">Produit introuvable ou retiré du catalogue.</p>
          <Link to="/stock" className="mt-3 inline-block text-primary underline">
            Retour au catalogue
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const images = Array.isArray(product.images) ? (product.images as string[]) : [];
  const kitText = buildMediaKitText(product as never);
  const commissionTotal = Number(product.commission_amount) * form.quantity;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Link to="/stock" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Catalogue
        </Link>

        {images.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={`${product.title} ${i + 1}`}
                loading="lazy"
                className="h-44 w-44 shrink-0 rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        <h1 className="mt-3 font-display text-lg font-black">{product.title}</h1>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABELS[product.category] ?? product.category} · {product.stock_quantity} disponibles
        </p>
        {product.description && <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>}
        {product.storage_location && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">
            <MapPin className="h-3 w-3" /> {product.storage_location}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Prix grossiste</p>
            <p className="text-sm font-black">{formatXOF(Number(product.wholesale_price))}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Prix conseillé</p>
            <p className="text-sm font-black">{formatXOF(Number(product.suggested_price))}</p>
          </div>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-success/15 py-2 text-sm font-black text-success">
          <TrendingUp className="h-4 w-4" /> Gagnez {formatXOF(Number(product.commission_amount))} / vente
        </p>

        <section className="mt-4 rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-bold">Pack média</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Copiez le texte marketing et téléchargez les photos HD pour publier sur WhatsApp, Facebook ou TikTok.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">
            {kitText}
          </pre>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(kitText);
                toast.success("Texte copié");
              }}
              className="rounded-lg border border-border py-2"
            >
              <Copy className="mr-1 inline h-3.5 w-3.5" /> Copier
            </button>
            <button
              onClick={() => {
                if (images.length === 0) return toast.error("Aucune photo disponible");
                images.forEach((src, i) => {
                  const a = document.createElement("a");
                  a.href = src;
                  a.download = `${product.title.replace(/\W+/g, "-").toLowerCase()}-${i + 1}.jpg`;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                });
              }}
              className="rounded-lg border border-border py-2"
            >
              <Download className="mr-1 inline h-3.5 w-3.5" /> Photos
            </button>
            <a
              href={whatsappLink("", kitText)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-success py-2 text-center text-success-foreground"
            >
              <Share2 className="mr-1 inline h-3.5 w-3.5" /> Partager
            </a>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-bold">Passer une commande client</h2>
          <div className="mt-2 space-y-2">
            <Field label="Nom du client" value={form.client_name} onChange={(v) => setForm({ ...form, client_name: v })} maxLength={100} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Téléphone 1" value={form.client_phone} onChange={(v) => setForm({ ...form, client_phone: v })} maxLength={30} />
              <Field label="Téléphone 2" value={form.client_phone_2} onChange={(v) => setForm({ ...form, client_phone_2: v })} maxLength={30} />
            </div>
            <Field label="Quartier / Commune" value={form.city_district} onChange={(v) => setForm({ ...form, city_district: v })} maxLength={100} />
            <Field label="Adresse précise / repère" value={form.delivery_address} onChange={(v) => setForm({ ...form, delivery_address: v })} maxLength={500} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Date de livraison</span>
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Quantité</span>
                <input
                  type="number"
                  min={1}
                  max={product.stock_quantity}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Prix de vente final (FCFA)</span>
              <input
                type="number"
                min={0}
                value={form.final_price}
                onChange={(e) => setForm({ ...form, final_price: e.target.value })}
                placeholder={String(Math.round(Number(product.suggested_price)))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </label>
          </div>

          <p className="mt-3 rounded-lg bg-success/10 p-2 text-center text-xs font-bold text-success">
            Votre commission sur cette commande : {formatXOF(commissionTotal)}
          </p>

          <button
            disabled={submit.isPending || !user}
            onClick={() => submit.mutate()}
            className="mt-3 w-full rounded-xl bg-gradient-brand py-3 text-sm font-black text-primary-foreground shadow-brand disabled:opacity-60"
          >
            {user ? (submit.isPending ? "Envoi…" : "Envoyer la commande à MSN") : "Connectez-vous pour commander"}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            MSN livre, encaisse le cash à la livraison et crédite automatiquement votre portefeuille.
          </p>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
      />
    </label>
  );
}
