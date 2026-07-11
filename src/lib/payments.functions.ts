import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InitPaymentSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Initiate a GeniusPay payment for an existing order.
 * Runs server-side with the secret key never exposed to the browser.
 */
export const initiateGeniusPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InitPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const secretKey = process.env.GENIUSPAY_SECRET_KEY;
    const publicKey = process.env.GENIUSPAY_PUBLIC_KEY;
    const apiUrl = process.env.GENIUSPAY_API_URL ?? "https://geniuspay.ci/api/v1/merchant";

    if (!secretKey || !publicKey) {
      throw new Error("GeniusPay non configuré (clés manquantes).");
    }

    // Fetch the order as the caller (RLS blocks other users' orders).
    const { data: order, error: orderErr } = await context.supabase
      .from("orders")
      .select("id, user_id, total_xof, shipping_type, quantity, product_id, payment_reference, payment_url, payment_status, status")
      .eq("id", data.orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) throw new Error("Commande introuvable.");
    if (order.user_id !== context.userId) throw new Error("Accès refusé.");

    // If we already have a valid payment URL for an unpaid order, reuse it.
    if (order.payment_status === "unpaid" && order.payment_url && order.payment_reference) {
      return { paymentUrl: order.payment_url, reference: order.payment_reference, reused: true };
    }
    if (order.payment_status === "paid") {
      return { paymentUrl: order.payment_url ?? "", reference: order.payment_reference ?? "", alreadyPaid: true };
    }

    // Load buyer profile for customer info.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", order.user_id)
      .maybeSingle();

    const reference = `MSN-${order.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const origin =
      process.env.SITE_URL ??
      process.env.PUBLIC_SITE_URL ??
      "https://groupage-connect.lovable.app";

    // GeniusPay merchant init payload (adjust field names if provider requires).
    const payload = {
      apikey: publicKey,
      site_id: publicKey,
      transaction_id: reference,
      amount: Math.round(Number(order.total_xof)),
      currency: "XOF",
      description: `MSN Courtier · Commande ${order.id.slice(0, 8)} · ${order.shipping_type === "sea" ? "Groupage maritime" : "Express aérien"}`,
      notify_url: `${origin}/api/public/webhooks/geniuspay`,
      return_url: `${origin}/payment/callback?ref=${reference}`,
      cancel_url: `${origin}/payment/callback?ref=${reference}&status=cancelled`,
      customer_name: profile?.full_name ?? "Client MSN",
      customer_phone_number: profile?.phone ?? "",
      channels: "ALL",
    };

    let providerResponse: any = null;
    let paymentUrl: string | null = null;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${secretKey}`,
          "X-API-Key": secretKey,
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      try {
        providerResponse = JSON.parse(text);
      } catch {
        providerResponse = { raw: text };
      }
      if (!res.ok) {
        console.error("[GeniusPay] init failed", res.status, providerResponse);
        throw new Error(
          `Paiement indisponible (${res.status}). ${providerResponse?.message ?? providerResponse?.error ?? "Réessayez plus tard."}`,
        );
      }
      paymentUrl =
        providerResponse?.data?.payment_url ??
        providerResponse?.payment_url ??
        providerResponse?.url ??
        providerResponse?.data?.url ??
        providerResponse?.redirect_url ??
        null;
    } catch (e) {
      console.error("[GeniusPay] network error", e);
      throw e instanceof Error ? e : new Error("Erreur réseau GeniusPay.");
    }

    if (!paymentUrl) {
      console.error("[GeniusPay] no payment_url in response", providerResponse);
      throw new Error("GeniusPay n'a pas renvoyé d'URL de paiement.");
    }

    // Persist payment info on the order.
    const { error: updErr } = await context.supabase
      .from("orders")
      .update({
        payment_provider: "geniuspay",
        payment_reference: reference,
        payment_url: paymentUrl,
        payment_status: "pending",
        payment_meta: providerResponse ?? null,
      })
      .eq("id", order.id);
    if (updErr) throw updErr;

    return { paymentUrl, reference, reused: false };
  });
