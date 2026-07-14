import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl";

const inputSchema = z.object({
  url: z
    .string()
    .trim()
    .url("URL invalide")
    .max(2048)
    .refine(
      (u) =>
        /^(https?:\/\/)([\w-]+\.)*(1688|taobao|tmall|alibaba|aliexpress|dewu|poizon|jd|weidian|xiaohongshu|pinduoduo|temu)\.(com|cn|net)/i.test(
          u,
        ),
      "URL non supportée. Utilisez 1688, Taobao, Tmall, Alibaba, AliExpress, JD, Dewu, Weidian, Temu.",
    ),
});

const productSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Nom du produit en français si possible, sinon original" },
    price_cny: { type: "number", description: "Prix unitaire en CNY (Yuan chinois). 0 si non trouvé." },
    price_range_cny: { type: "string", description: "Plage de prix si multi-variantes (ex: 10-25)" },
    currency_detected: { type: "string" },
    main_image: { type: "string", description: "URL absolue de l'image principale" },
    images: { type: "array", items: { type: "string" }, description: "Jusqu'à 8 URLs d'images du produit" },
    variants: {
      type: "array",
      description: "Variantes (couleur, taille, style). Vide si aucune.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Ex: 'Rouge / M'" },
          price_cny: { type: "number" },
          image: { type: "string" },
        },
      },
    },
    seller: { type: "string" },
    min_order_quantity: { type: "number" },
    source_platform: { type: "string", description: "1688, taobao, aliexpress, tmall, jd, dewu, temu, etc." },
  },
  required: ["title"],
};

export const scrapeProductPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!lovableKey || !firecrawlKey) {
      throw new Error("Firecrawl connector not configured");
    }

    const res = await fetch(`${GATEWAY_URL}/v2/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: data.url,
        formats: [
          { type: "json", schema: productSchema, prompt: "Extrais les infos produit de cette page marketplace chinoise. Convertis toute devise trouvée en CNY (1 USD ≈ 7.25 CNY). Retourne au moins le titre et le prix." },
          "markdown",
        ],
        onlyMainContent: true,
        waitFor: 1500,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Firecrawl scrape failed [${res.status}]: ${body}`);
      throw new Error(`Scraping échoué (${res.status}). Réessayez ou saisissez manuellement.`);
    }

    const payload = await res.json();
    const doc = payload.data ?? payload;
    const product = doc.json ?? doc.data?.json ?? null;

    if (!product || !product.title) {
      throw new Error("Impossible d'extraire les infos produit. Saisissez manuellement.");
    }

    return {
      title: String(product.title),
      price_cny: Number(product.price_cny) || 0,
      price_range_cny: product.price_range_cny ?? null,
      main_image: product.main_image ?? product.images?.[0] ?? null,
      images: Array.isArray(product.images) ? product.images.slice(0, 8) : [],
      variants: Array.isArray(product.variants) ? product.variants.slice(0, 30) : [],
      seller: product.seller ?? null,
      min_order_quantity: product.min_order_quantity ?? 1,
      source_platform: product.source_platform ?? null,
      source_url: data.url,
    };
  });
