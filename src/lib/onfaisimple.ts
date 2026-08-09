/** Constantes partagées du module OnFaiSimple™ (sourcing participatif géré). */

export const OFS_CATEGORIES = ["electronique", "beaute", "gadgets", "maison"] as const;

export const OFS_CATEGORY_LABELS: Record<string, string> = {
  electronique: "Électronique",
  beaute: "Beauté",
  gadgets: "Gadgets",
  maison: "Maison",
  general: "Général",
};

export const OFS_STAGES = [
  "COMMANDE_VALIDEE",
  "ACHAT_CHINE",
  "ENTREPOT_CHINE",
  "EN_TRANSIT",
  "DEDOUANEMENT",
  "EN_VENTE",
  "GAIN_CLOTURE",
] as const;

export type OfsStage = (typeof OFS_STAGES)[number];

export const OFS_STAGE_LABELS: Record<OfsStage, string> = {
  COMMANDE_VALIDEE: "Commande validée",
  ACHAT_CHINE: "Achat en Chine",
  ENTREPOT_CHINE: "Entrepôt MSN Chine",
  EN_TRANSIT: "En transit",
  DEDOUANEMENT: "Dédouanement Abidjan",
  EN_VENTE: "En vente (Stock Express)",
  GAIN_CLOTURE: "Gain & clôture",
};

export const OFS_STAGE_HINTS: Record<OfsStage, string> = {
  COMMANDE_VALIDEE: "Contrat de mandat signé et commande enregistrée.",
  ACHAT_CHINE: "Article acheté chez le fournisseur (reçu photo).",
  ENTREPOT_CHINE: "Colis réceptionné et pesé à l'entrepôt MSN Chine.",
  EN_TRANSIT: "Chargé en conteneur ou en fret aérien.",
  DEDOUANEMENT: "Arrivé aux douanes d'Abidjan.",
  EN_VENTE: "Listé sur le réseau de force de vente locale.",
  GAIN_CLOTURE: "Vendu ! Capital + profit crédités sur votre portefeuille.",
};

export const OFS_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En vérification",
  approved: "Validé",
  rejected: "Refusé",
};

export const OFS_PRODUCT_STATUS_LABELS: Record<string, string> = {
  funding: "Financement ouvert",
  closed: "Lot complet",
  completed: "Cycle terminé",
  hidden: "Masqué",
};

export interface OfsProductLike {
  unit_cost: number;
  projected_retail_price: number;
  user_profit_share_percent: number;
}

/** Profit net reversé à l'utilisateur pour `units` unités. */
export function ofsProfit(p: OfsProductLike, units: number): number {
  return Math.round(
    (p.projected_retail_price - p.unit_cost) * units * (p.user_profit_share_percent / 100),
  );
}

export function ofsTotalCost(p: OfsProductLike, units: number): number {
  return Math.round(p.unit_cost * units);
}

export function ofsPayout(p: OfsProductLike, units: number): number {
  return ofsTotalCost(p, units) + ofsProfit(p, units);
}

/** Rendement en % du capital engagé. */
export function ofsReturnPercent(p: OfsProductLike): number {
  if (p.unit_cost <= 0) return 0;
  return Math.round((ofsProfit(p, 1) / p.unit_cost) * 100);
}

export function ofsQrUrl(address: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(address)}`;
}

export function ofsMandateText(input: {
  reference: string;
  fullName: string;
  productTitle: string;
  units: number;
  total: number;
  payout: number;
  days: number;
  sharePercent: number;
}): string {
  return `CONTRAT DE MANDAT DE VENTE COMMERCIALE
Référence : ${input.reference}

Entre les soussignés :
— MSN COURTIER (ci-après « le Mandataire »), opérateur du service OnFaiSimple™, chargé du sourcing, de l'importation, du dédouanement et de la commercialisation locale des marchandises ;
— ${input.fullName || "Le Mandant"} (ci-après « le Mandant »), donneur d'ordre.

Article 1 — Objet
Le Mandant confie au Mandataire un mandat de sourcing et de vente commerciale portant sur ${input.units} unité(s) du lot « ${input.productTitle} ».

Article 2 — Financement
Le Mandant finance le sourcing pour un montant total de ${input.total} FCFA, réputé versé dès validation du paiement par le Mandataire.

Article 3 — Répartition du résultat
La marge nette dégagée par la revente locale est partagée à hauteur de ${input.sharePercent}% au profit du Mandant. Le versement attendu, capital inclus, est estimé à ${input.payout} FCFA.

Article 4 — Délai
Le cycle complet (achat en Chine, transit, dédouanement, mise en vente) est estimé à ${input.days} jours à compter de la validation du paiement.

Article 5 — Suivi
Le Mandant suit l'exécution du mandat en temps réel via les 7 étapes de traçabilité du module OnFaiSimple™.

Article 6 — Aléa commercial
Le Mandataire s'engage à mettre en œuvre tous les moyens de commercialisation de son réseau. Les projections de marge sont des estimations fondées sur les prix de marché constatés et ne constituent pas une garantie de rendement.

Article 7 — Règlement
Le capital et le profit sont crédités sur le portefeuille MSN du Mandant à l'étape « Gain & clôture », et retirables selon les conditions de retrait en vigueur.

Signature électronique du Mandant : validation par code PIN à 4 chiffres, valant consentement au sens des usages du commerce électronique.`;
}
