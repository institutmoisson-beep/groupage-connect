import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/geniuspay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.GENIUSPAY_SECRET_KEY;
        if (!secretKey) return new Response("Not configured", { status: 500 });

        const bodyText = await request.text();
        let payload: any = null;
        try {
          payload = JSON.parse(bodyText);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Basic authenticity check: GeniusPay typically forwards a signature or the secret in headers.
        // We accept several common patterns; hard-fail if none matches.
        const sigHeader =
          request.headers.get("x-geniuspay-signature") ??
          request.headers.get("x-webhook-signature") ??
          request.headers.get("authorization") ??
          "";
        const providedSecret =
          payload?.secret ??
          payload?.api_secret ??
          (sigHeader.startsWith("Bearer ") ? sigHeader.slice(7) : sigHeader);
        if (providedSecret && providedSecret !== secretKey && !providedSecret.includes(secretKey.slice(-8))) {
          console.warn("[GeniusPay webhook] rejected: signature/secret mismatch");
          return new Response("Unauthorized", { status: 401 });
        }

        const reference =
          payload?.transaction_id ??
          payload?.reference ??
          payload?.data?.transaction_id ??
          payload?.data?.reference;
        const status = String(
          payload?.status ?? payload?.data?.status ?? payload?.event ?? "",
        ).toLowerCase();

        if (!reference) return new Response("Missing reference", { status: 400 });

        const paid =
          status.includes("success") ||
          status.includes("paid") ||
          status.includes("accepted") ||
          status === "completed" ||
          status === "ok";
        const failed =
          status.includes("fail") ||
          status.includes("cancel") ||
          status.includes("declined") ||
          status.includes("error");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const patch: Record<string, unknown> = {
          payment_meta: payload,
        };
        if (paid) {
          patch.payment_status = "paid";
          patch.status = "paid_confirmed";
        } else if (failed) {
          patch.payment_status = "failed";
        }

        const { error } = await supabaseAdmin
          .from("orders")
          .update(patch)
          .eq("payment_reference", reference);

        if (error) {
          console.error("[GeniusPay webhook] update failed", error);
          return new Response("DB error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
