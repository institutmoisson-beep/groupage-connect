import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ CLIENT ============

const createOrderSchema = z.object({
  productId: z.string().uuid(),
  paymentChannel: z.enum(["agent_cash", "mobile_money_online"]),
  agentId: z.string().uuid().nullable(),
  deliveryAddress: z.string().trim().min(5).max(300),
  deliveryPhone: z.string().trim().min(6).max(20),
});

/** Crée une commande séquestre ViDa ; le montant et le voucher sont calculés côté serveur. */
export const vidaCreateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any).rpc("vida_create_order", {
      p_product_id: data.productId,
      p_payment_channel: data.paymentChannel,
      p_agent_id: data.agentId,
      p_delivery_address: data.deliveryAddress,
      p_delivery_phone: data.deliveryPhone,
    });
    if (error) throw new Error(error.message);
    return order;
  });

const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().max(300).optional().default(""),
});

/** Annulation client dans la fenêtre dynamique ; pénalité appliquée automatiquement côté SQL. */
export const vidaCancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any).rpc("vida_cancel_order", {
      p_order_id: data.orderId,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return order;
  });

// ============ AGENT MOBILE MONEY ============

const orderCodeSchema = z.object({ orderCode: z.string().trim().length(8) });

/** Agent scanne le voucher client, verrouille les fonds en séquestre, l'OTP de livraison est généré. */
export const vidaAgentLockFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderCodeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any).rpc("vida_agent_lock_funds", {
      p_order_code: data.orderCode,
    });
    if (error) throw new Error(error.message);
    return order;
  });

const refundOrderIdSchema = z.object({ orderId: z.string().uuid() });

/** Agent restitue le cash au client sur une commande annulée en attente de remboursement. */
export const vidaAgentProcessRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => refundOrderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any).rpc(
      "vida_agent_process_refund",
      {
        p_order_id: data.orderId,
      },
    );
    if (error) throw new Error(error.message);
    return order;
  });

const settleRecoverySchema = z.object({
  amount: z.number().positive(),
  referenceCode: z.string().trim().min(4).max(100),
  counterpartyId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
});

/** Déclenche un mouvement de récupération de cash dans le mode configuré pour l'agent connecté. */
export const vidaAgentSettleRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settleRecoverySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc("vida_agent_settle_recovery", {
      p_amount: data.amount,
      p_reference_code: data.referenceCode,
      p_counterparty_id: data.counterpartyId ?? null,
      p_order_id: data.orderId ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

// ============ LIVREUR ============

const confirmDeliverySchema = z.object({
  orderId: z.string().uuid(),
  otp: z.string().trim().length(6),
});

/** Valide l'OTP de livraison : déclenche le split automatique vendeur/agent/livreur/plateforme. */
export const vidaConfirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => confirmDeliverySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await (context.supabase as any).rpc("vida_confirm_delivery", {
      p_order_id: data.orderId,
      p_otp: data.otp,
    });
    if (error) throw new Error(error.message);
    return order;
  });

// ============ ADMIN ============

const configureAgentSchema = z.object({
  agentId: z.string().uuid(),
  recoveryMode: z.enum(["AUTO_LOOP", "API_TOPUP", "PHYSICAL_COLLECT"]),
  maxCashLimit: z.number().positive(),
  securityDeposit: z.number().min(0),
  isActive: z.boolean(),
});

/** Panneau admin : bascule le mode de récupération de cash et les limites pour un agent donné. */
export const vidaAdminConfigureAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => configureAgentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc("vida_admin_configure_agent", {
      p_agent_id: data.agentId,
      p_recovery_mode: data.recoveryMode,
      p_max_cash_limit: data.maxCashLimit,
      p_security_deposit: data.securityDeposit,
      p_is_active: data.isActive,
    });
    if (error) throw new Error(error.message);
    return row;
  });

const setRoleStatusSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["agent", "courier", "vendor"]),
  isApproved: z.boolean(),
  isSuspended: z.boolean(),
});

/** Panneau admin RBAC : approuve/suspend un compte Agent, Livreur ou Vendeur ViDa. */
export const vidaAdminSetRoleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setRoleStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc("vida_admin_set_role_status", {
      p_user_id: data.userId,
      p_role: data.role,
      p_is_approved: data.isApproved,
      p_is_suspended: data.isSuspended,
    });
    if (error) throw new Error(error.message);
    return row;
  });

const updateProductRulesSchema = z.object({
  productId: z.string().uuid(),
  cancellationWindowHours: z.number().int().min(0).max(720),
  cancellationPenaltyPercentage: z.number().min(0).max(100),
  agentCommissionPercentage: z.number().min(0).max(100),
  platformCommissionPercentage: z.number().min(0).max(100),
});

/** Panneau admin : override par produit des règles d'annulation et de commissions. */
export const vidaAdminUpdateProductRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProductRulesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc(
      "vida_admin_update_product_rules",
      {
        p_product_id: data.productId,
        p_cancellation_window_hours: data.cancellationWindowHours,
        p_cancellation_penalty_percentage: data.cancellationPenaltyPercentage,
        p_agent_commission_percentage: data.agentCommissionPercentage,
        p_platform_commission_percentage: data.platformCommissionPercentage,
      },
    );
    if (error) throw new Error(error.message);
    return row;
  });
