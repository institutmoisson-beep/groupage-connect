/** Constantes et libellés partagés du module MSN Stock Express (déstockage & revente affiliée). */

export const STOCK_CATEGORIES = [
  "general",
  "electronique",
  "mode",
  "maison",
  "beaute",
  "telephonie",
  "outillage",
  "enfant",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  electronique: "Électronique",
  mode: "Mode & Textile",
  maison: "Maison & Déco",
  beaute: "Beauté & Cosmétique",
  telephonie: "Téléphonie & Accessoires",
  outillage: "Outillage & Bâtiment",
  enfant: "Enfant & Puériculture",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  pending_review: "En validation",
  active: "En vente",
  sold_out: "Épuisé",
  hidden: "Masqué",
  rejected: "Refusé",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  dispatched: "En cours de livraison",
  delivered: "Livré & Payé",
  cancelled: "Annulée",
};

export const ORDER_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/40",
  dispatched: "bg-secondary/10 text-secondary border-secondary/30",
  delivered: "bg-success/15 text-success border-success/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export const WITHDRAWAL_METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN MoMo",
  moov_money: "Moov Money",
  bank_transfer: "Virement bancaire",
};

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  paid: "Payé",
  rejected: "Refusé",
};

export const WALLET_TX_LABELS: Record<string, string> = {
  wholesale_credit: "Vente grossiste",
  commission_credit: "Commission revente",
  delivery_fee: "Frais de livraison",
  withdrawal_debit: "Retrait",
  adjustment: "Ajustement",
};

export interface StockProductLike {
  title: string;
  description?: string | null;
  suggested_price: number;
  commission_amount: number;
  storage_location?: string | null;
  media_kit_text?: string | null;
}

/** Texte marketing prêt à coller sur WhatsApp / Facebook / TikTok. */
export function buildMediaKitText(p: StockProductLike, sellerPhone?: string): string {
  if (p.media_kit_text?.trim()) return p.media_kit_text.trim();
  const price = Math.round(p.suggested_price).toLocaleString("fr-FR").replace(/\u202f|\s/g, " ");
  return [
    `🔥 ${p.title} — DISPONIBLE À ABIDJAN 🔥`,
    "",
    p.description?.trim() ? p.description.trim() : "Qualité importée, stock limité.",
    "",
    `💰 Prix : ${price} FCFA`,
    "🚚 Livraison rapide, paiement à la livraison (cash)",
    "✅ Produit vérifié, importé par conteneur MSN Cargo",
    "",
    `📲 Commandez maintenant${sellerPhone ? ` : ${sellerPhone}` : " en message privé"}`,
    "#Abidjan #CoteDivoire #LivraisonRapide #BonAffaire",
  ].join("\n");
}

export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
