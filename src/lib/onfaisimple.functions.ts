import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const proofSchema = z.object({ orderId: z.string().uuid() });

/**
 * Renvoie la preuve de paiement encodée en base64 plutôt que l'URL Supabase Storage brute.
 * Le champ `payment_proof_url` en base contient un lien signé qui expose le nom de domaine
 * (donc l'ID) du projet Supabase. Passer par ce serveur function évite que ce lien apparaisse
 * dans le DOM, la barre d'adresse ou l'historique de navigation de l'admin.
 *
 * L'autorisation repose sur la RLS de `onfaisimple_orders` (propriétaire OU admin), on utilise
 * donc le client authentifié plutôt que supabaseAdmin (service role peu fiable sur Lovable Cloud).
 */
export const getPaymentProofImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proofSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any)
      .from("onfaisimple_orders")
      .select("payment_proof_url")
      .eq("id", data.orderId)
      .single();
    if (error) throw new Error(error.message);

    const url = (order as { payment_proof_url: string | null } | null)?.payment_proof_url;
    if (!url) throw new Error("Aucune preuve de paiement disponible pour cette commande.");

    const res = await fetch(url);
    if (!res.ok) throw new Error("Impossible de récupérer la preuve de paiement.");

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { dataUrl: `data:${contentType};base64,${base64}` };
  });
