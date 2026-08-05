import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Solde = crédits - débits du portefeuille, moins les retraits déjà en attente. */
async function computeBalance(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ balance: number; pending: number; available: number }> {
  const { data: txs, error } = await supabase
    .from("wallet_transactions")
    .select("amount_xof")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const balance = (txs ?? []).reduce((s: number, t: any) => s + Number(t.amount_xof ?? 0), 0);

  const { data: reqs, error: rErr } = await supabase
    .from("withdrawal_requests")
    .select("amount_xof, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"]);
  if (rErr) throw new Error(rErr.message);
  const pending = (reqs ?? []).reduce((s: number, r: any) => s + Number(r.amount_xof ?? 0), 0);

  return { balance, pending, available: balance - pending };
}

export const getWalletSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => computeBalance(context.supabase as never, context.userId));

const withdrawSchema = z.object({
  amountXof: z.number().min(1000, "Minimum 1 000 FCFA").max(50_000_000),
  method: z.enum(["wave", "orange_money", "mtn_money", "moov_money", "bank_transfer"]),
  accountIdentifier: z.string().trim().min(6, "Numéro/IBAN requis").max(60),
  accountHolder: z.string().trim().min(2).max(120),
});

/** Demande de retrait : le solde disponible est contrôlé côté serveur. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { available } = await computeBalance(context.supabase as never, context.userId);
    if (data.amountXof > available) {
      throw new Error(`Solde disponible insuffisant (${Math.round(available)} FCFA).`);
    }
    const { error } = await context.supabase.from("withdrawal_requests").insert({
      user_id: context.userId,
      amount_xof: data.amountXof,
      method: data.method,
      account_identifier: data.accountIdentifier,
      account_holder: data.accountHolder,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, available: available - data.amountXof };
  });

const settleSchema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(["approve", "pay", "reject"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Traitement admin d'un retrait via la fonction SQL SECURITY DEFINER `settle_withdrawal`.
 * On passe par le client authentifié (RLS) plutôt que par supabaseAdmin (service role),
 * ce dernier ayant déjà causé des échecs silencieux sur Lovable Cloud (cf. MSN Tontine).
 */
export const settleWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any)
      .rpc("settle_withdrawal", {
        p_withdrawal_id: data.withdrawalId,
        p_action: data.action,
        p_note: data.note ?? null,
      })
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, status: (result as { status: string }).status };
  });
