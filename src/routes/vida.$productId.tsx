import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Wallet, Store } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { VIDA_PAYMENT_CHANNEL_LABELS } from "@/lib/vida";
import { vidaCreateOrder } from "@/lib/vida.functions";

export const Route = createFileRoute("/vida/$productId")({
  head: () => ({
    meta: [
      { title: "Commander via ViDa — Paiement Séquestre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VidaProductDetail,
});

function VidaProductDetail() {
  const { productId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrder = useServerFn(vidaCreateOrder);

  const [channel, setChannel] = useState<"agent_cash" | "mobile_money_online">("agent_cash");
  const [agentId, setAgentId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const { data: product } = useQuery({
    queryKey: ["vida-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_products")
        .select("*")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["vida-active-agents"],
    enabled: channel === "agent_cash",
    queryFn: async () => {
      const { data, error } = await supabase.from("vida_active_agents").select("*");
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      createOrder({
        data: {
          productId,
          paymentChannel: channel,
          agentId: channel === "agent_cash" ? agentId || null : null,
          deliveryAddress: address,
          deliveryPhone: phone,
        },
      }),
    onSuccess: (order: any) => {
      toast.success("Commande ViDa créée — présentez votre voucher à l'agent.");
      navigate({ to: "/vida/orders/$orderId", params: { orderId: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 text-sm text-muted-foreground">
          Chargement du produit…
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-24">
        <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <h1 className="mt-3 font-display text-lg font-black">{product.title}</h1>
        {product.description && (
          <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
        )}
        <p className="mt-2 text-xl font-black text-primary">
          {formatXOF(Number(product.price_xof))}
        </p>
        <p className="text-[11px] text-muted-foreground">
          + {formatXOF(Number(product.delivery_fee_xof))} de livraison · annulable{" "}
          {product.cancellation_window_hours}h après verrouillage (pénalité{" "}
          {product.cancellation_penalty_percentage}%)
        </p>
        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
          <ShieldCheck className="h-3 w-3" /> Paiement Séquestre Garanti
        </div>

        {!user ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            Connectez-vous pour commander via ViDa.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-bold">Mode de paiement séquestre</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["agent_cash", "mobile_money_online"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-[10px] font-bold ${
                      channel === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {c === "agent_cash" ? (
                      <Store className="h-4 w-4" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    {VIDA_PAYMENT_CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {channel === "agent_cash" && (
              <div>
                <label className="text-xs font-bold">Agent Mobile Money partenaire</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background p-2.5 text-xs"
                >
                  <option value="">Choisir à l'arrivée chez un agent proche</option>
                  {(agents ?? []).map((a: any) => (
                    <option key={a.agent_id} value={a.agent_id}>
                      {a.full_name} — {a.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold">Adresse de livraison</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-input bg-background p-2.5 text-xs"
                placeholder="Quartier, rue, repère…"
              />
            </div>
            <div>
              <label className="text-xs font-bold">Téléphone de contact</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background p-2.5 text-xs"
                placeholder="07 00 00 00 00"
              />
            </div>

            <button
              onClick={() => submit.mutate()}
              disabled={
                submit.isPending || !address || !phone || (channel === "agent_cash" && !agentId)
              }
              className="w-full rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
            >
              {submit.isPending ? "Création…" : "Générer mon voucher séquestre"}
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
