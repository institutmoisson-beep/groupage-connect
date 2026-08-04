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

/** Traitement admin d'un retrait : le débit portefeuille est écrit au moment du paiement. */
export const settleWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé à l'administration.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id, user_id, amount_xof, status, method")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Demande introuvable.");
    if (row.status === "paid") throw new Error("Ce retrait est déjà payé.");

    const nextStatus = data.action === "approve" ? "approved" : data.action === "pay" ? "paid" : "rejected";

    const { error: upErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: nextStatus,
        admin_notes: data.note ?? null,
        processed_at: data.action === "pay" ? new Date().toISOString() : null,
      } as never)
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);

    if (data.action === "pay") {
      const { error: txErr } = await supabaseAdmin.from("wallet_transactions").insert({
        user_id: row.user_id,
        amount_xof: -Math.abs(Number(row.amount_xof)),
        type: "withdrawal_debit",
        label: `Retrait payé (${row.method})`,
        withdrawal_id: row.id,
      } as never);
      if (txErr) throw new Error(txErr.message);
    }

    return { ok: true, status: nextStatus };
  });
