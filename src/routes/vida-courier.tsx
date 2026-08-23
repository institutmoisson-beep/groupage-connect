import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, MapPin, Phone, ShieldAlert, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useVidaRole } from "@/hooks/use-vida-role";
import { formatXOF } from "@/lib/format";
import { vidaFormatOrderCode } from "@/lib/vida";
import { vidaConfirmDelivery } from "@/lib/vida.functions";

export const Route = createFileRoute("/vida-courier")({
  head: () => ({ meta: [{ title: "App Livreur — ViDa" }, { name: "robots", content: "noindex" }] }),
  component: VidaCourierPortal,
});

function VidaCourierPortal() {
  const { user, loading } = useAuth();
  const { hasRole, isPending, loading: roleLoading } = useVidaRole("courier");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirmDelivery = useServerFn(vidaConfirmDelivery);

  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/auth", search: { redirect: "/vida-courier" } as never });
  }, [loading, user, navigate]);

  // Colis prêts à livrer (fonds verrouillés) : soit déjà assignés à ce livreur,
  // soit en attente de prise en charge (dispatch ouvert).
  const { data: orders, isLoading } = useQuery({
    queryKey: ["vida-courier-dispatch", user?.id],
    enabled: !!user && hasRole,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vida_escrow_orders")
        .select("*, vida_products(title)")
        .in("status", ["funds_locked", "in_transit"])
        .or(`courier_id.eq.${user!.id},courier_id.is.null`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const confirm = useMutation({
    mutationFn: (orderId: string) =>
      confirmDelivery({ data: { orderId, otp: otpByOrder[orderId] ?? "" } }),
    onSuccess: (order: any) => {
      toast.success(
        `Livraison confirmée — paiement instantané pour ${vidaFormatOrderCode(order.order_code)}.`,
      );
      qc.invalidateQueries({ queryKey: ["vida-courier-dispatch"] });
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
            ? "Votre compte Livreur est en attente de validation par l'administration."
            : "Accès réservé aux livreurs approuvés."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <h1 className="flex items-center gap-1.5 font-display text-base font-black">
          <Truck className="h-4 w-4" /> Dispatch Livreur ViDa
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement des courses…</p>}
        {(orders ?? []).map((o: any) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">{o.vida_products?.title}</p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {vidaFormatOrderCode(o.order_code)}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {o.delivery_address}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3" /> {o.delivery_phone}
            </p>
            <p className="mt-1 text-xs font-black text-primary">
              {formatXOF(Number(o.delivery_fee))} de frais de course
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={otpByOrder[o.id] ?? ""}
                  onChange={(e) => setOtpByOrder((s) => ({ ...s, [o.id]: e.target.value }))}
                  placeholder="OTP client (6 chiffres)"
                  maxLength={6}
                  className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2 text-xs font-mono tracking-widest"
                />
              </div>
              <button
                onClick={() => confirm.mutate(o.id)}
                disabled={confirm.isPending || (otpByOrder[o.id]?.length ?? 0) !== 6}
                className="rounded-lg bg-success px-3 py-2 text-xs font-black text-success-foreground disabled:opacity-50"
              >
                Valider
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (orders ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune course en attente pour l'instant.
          </p>
        )}
      </main>
    </div>
  );
}
