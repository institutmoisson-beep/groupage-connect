import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle, Package } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  ref: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Paiement — MSN Courtier" }] }),
  component: PaymentCallback,
});

function PaymentCallback() {
  const { ref, status } = useSearch({ from: "/payment/callback" });

  const { data: order, refetch } = useQuery({
    queryKey: ["payment-callback", ref],
    enabled: !!ref,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.payment_status;
      return s === "pending" ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, payment_status, status, total_xof")
        .eq("payment_reference", ref!)
        .maybeSingle();
      return data;
    },
  });

  const cancelled = status === "cancelled";
  const paid = order?.payment_status === "paid";
  const failed = order?.payment_status === "failed" || cancelled;
  const pending = !paid && !failed;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-background px-6 text-center">
      {paid ? (
        <>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-4 font-display text-xl font-black">Paiement confirmé !</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre commande est validée. Suivez son acheminement dans « Mes commandes ».
          </p>
        </>
      ) : failed ? (
        <>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-destructive/15 text-destructive">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="mt-4 font-display text-xl font-black">Paiement non abouti</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {cancelled
              ? "Vous avez annulé le paiement."
              : "Le paiement a échoué. Vous pouvez réessayer depuis la commande."}
          </p>
        </>
      ) : (
        <>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-warning/15 text-warning">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>
          <h1 className="mt-4 font-display text-xl font-black">Confirmation en cours…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous attendons la confirmation de GeniusPay. Cela prend quelques secondes.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Actualiser
          </button>
        </>
      )}

      <div className="mt-6 flex w-full flex-col gap-2">
        <Link
          to="/orders"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand py-3 text-sm font-bold text-primary-foreground shadow-brand"
        >
          <Package className="h-4 w-4" /> Mes commandes
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-border bg-card py-3 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          Retour à l'accueil
        </Link>
      </div>

      {pending && ref && (
        <p className="mt-6 text-[10px] text-muted-foreground">Réf : {ref}</p>
      )}
    </div>
  );
}
