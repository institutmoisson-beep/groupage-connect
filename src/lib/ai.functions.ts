import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  productId: z.string().uuid(),
});

type EnhanceResult = {
  title: string;
  description: string;
  marketing_whatsapp: string;
  marketing_tiktok: string;
  profit_score: number;
  profit_reason: string;
};

/**
 * Uses Lovable AI Gateway to rewrite a product's title/description in
 * commercial French, generate a WhatsApp + TikTok marketing pack and a
 * 0-100 profit-probability score.
 * Admin-only.
 */
export const enhanceProductContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<EnhanceResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquant.");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: product, error } = await context.supabase
      .from("products")
      .select("id, title, description, category, cny_price, exchange_rate_cny_xof, logistics_fee_xof")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw error;
    if (!product) throw new Error("Produit introuvable.");

    const priceXOF = Math.round(
      product.cny_price * product.exchange_rate_cny_xof + product.logistics_fee_xof,
    );

    const prompt = `Tu es le copywriter e-commerce de MSN Courtier (Côte d'Ivoire, groupage import Chine).
Produit : ${product.title}
Catégorie : ${product.category}
Description actuelle : ${product.description ?? "(vide)"}
Prix vente final : ${priceXOF} FCFA.

Réponds STRICTEMENT en JSON valide (aucun texte autour) avec ces clés :
{
  "title": "titre commercial percutant en français ivoirien, max 60 caractères",
  "description": "description vendeuse 3 lignes max, bénéfices concrets, mentionne le prix",
  "marketing_whatsapp": "message WhatsApp prêt à copier, 4-6 lignes avec 1 emoji par ligne max, appel à l'action",
  "marketing_tiktok": "script TikTok 15s : hook + 3 bénéfices + CTA, style oral",
  "profit_score": nombre entre 0 et 100 estimant la probabilité de bonne rentabilité pour un revendeur ivoirien,
  "profit_reason": "1 phrase expliquant le score"
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu réponds uniquement en JSON strict, sans backticks." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[AI] failed", res.status, text);
      throw new Error(`IA indisponible (${res.status}).`);
    }

    const payload = (await res.json()) as any;
    const raw = payload?.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.replace(/```json|```/g, "").trim();

    let parsed: EnhanceResult;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error("[AI] JSON parse failed", raw);
      throw new Error("Réponse IA invalide.");
    }

    return parsed;
  });
