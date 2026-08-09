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
  signedAt?: string;
}): string {
  return `CONTRAT DE MANDAT DE VENTE COMMERCIALE
Référence : ${input.reference}${input.signedAt ? `\nSigné le : ${input.signedAt}` : ""}

Entre les soussignés :
— MSN COURTIER (ci-après « le Mandataire »), opérateur du service OnFaiSimple™, filiale de l'Institut Moisson, chargé du sourcing, de l'importation, du dédouanement et de la commercialisation locale des marchandises ;
— ${input.fullName || "Le Mandant"} (ci-après « le Mandant »), donneur d'ordre et bailleur du capital de financement ci-dessous décrit.

Article 1 — Objet
Le Mandant confie au Mandataire un mandat de sourcing et de vente commerciale portant sur ${input.units} unité(s) du lot « ${input.productTitle} ».

Article 2 — Financement
Le Mandant finance le sourcing pour un montant total de ${input.total} FCFA, réputé versé dès validation du paiement par le Mandataire. Ce montant constitue le « capital de financement » au sens du présent contrat.

Article 3 — Garantie de reversement du capital de financement
Le Mandataire garantit au Mandant le reversement intégral du capital de financement visé à l'Article 2, dans les conditions suivantes :
a) le capital est adossé à la valeur des marchandises physiquement acquises pour le compte du Mandant dès l'étape « Achat en Chine », ainsi qu'à un fonds de garantie interne constitué et maintenu par le Mandataire ;
b) si, à l'issue du délai indiqué à l'Article 5, le lot n'a pu être intégralement écoulé, le Mandataire prolonge la commercialisation ou procède, au choix du Mandant, au reversement du capital dans un délai maximal de trente (30) jours à compter de la demande, hors profit non encore réalisé ;
c) si la campagne de groupage à laquelle appartient le lot n'atteint pas le volume cible avant sa date de clôture, le Mandataire rembourse intégralement le capital engagé, sans retenue ni pénalité, dans un délai maximal de quinze (15) jours ;
d) le reversement du capital reste dû même en l'absence de profit, sous réserve des seuls cas d'exclusion prévus à l'Article 4 ;
e) la présente garantie porte exclusivement sur le capital de financement. Le profit visé à l'Article 6 demeure soumis à l'aléa commercial décrit à l'Article 8 et n'est ni garanti ni forfaitaire.

Article 4 — Garanties liées aux risques de sourcing et de transport
Le Mandataire met en œuvre les protections suivantes au bénéfice du Mandant contre les risques inhérents à l'importation :
a) vérification du fournisseur avant paiement, et conservation des reçus d'achat et bons de pesée de l'entrepôt MSN Chine, communicables au Mandant sur simple demande ;
b) une assurance transport optionnelle peut être souscrite par le Mandant, aux frais indiqués sur l'application, couvrant la casse, la perte ou le vol survenus pendant le transit maritime ou aérien ;
c) en cas de sinistre couvert par une assurance souscrite, le Mandataire reverse au Mandant l'indemnité perçue de l'assureur, capital de financement inclus, dans un délai maximal de trente (30) jours à compter du règlement par l'assureur ;
d) à défaut de souscription d'assurance transport, les risques de casse, perte ou vol en cours de transit restent à la charge du Mandant, dans la limite du capital investi et sans jamais excéder ce montant, sans préjudice de la garantie de reversement de l'Article 3 lorsque le sinistre n'est pas la cause de la non-restitution du capital ;
e) sont exclus de toute garantie (capital et risques) les cas de force majeure au sens du droit ivoirien (catastrophe naturelle, guerre, émeute, blocage douanier prolongé, décision administrative ou réglementaire imprévisible), ainsi que toute fraude, fausse déclaration ou manœuvre imputable au Mandant ;
f) la présente garantie couvre le capital financier engagé ; elle ne constitue pas une garantie commerciale sur la qualité, la conformité technique ou la durée de vie des marchandises importées, régie par l'Article 4 des Conditions Générales d'Utilisation et de Vente.

Article 5 — Délai
Le cycle complet (achat en Chine, transit, dédouanement, mise en vente) est estimé à ${input.days} jours à compter de la validation du paiement. Ce délai est indicatif ; en cas de dépassement significatif, les garanties de reversement de l'Article 3 s'appliquent de plein droit.

Article 6 — Répartition du résultat
La marge nette dégagée par la revente locale est partagée à hauteur de ${input.sharePercent}% au profit du Mandant. Le versement total attendu, capital inclus, est estimé à ${input.payout} FCFA.

Article 7 — Suivi
Le Mandant suit l'exécution du mandat en temps réel via les 7 étapes de traçabilité du module OnFaiSimple™, ainsi que via l'accès permanent au présent contrat signé depuis son espace « Mes mandats ».

Article 8 — Aléa commercial
Le Mandataire s'engage à mettre en œuvre tous les moyens de commercialisation de son réseau. Les projections de marge sont des estimations fondées sur les prix de marché constatés et ne constituent pas une garantie de rendement. Seul le capital de financement bénéficie de la garantie de reversement décrite à l'Article 3 ; le profit reste variable et dépend de la vente effective du lot.

Article 9 — Règlement
Le capital et le profit sont crédités sur le portefeuille MSN du Mandant à l'étape « Gain & clôture », ou reversés selon les modalités de garantie de l'Article 3 le cas échéant, et retirables selon les conditions de retrait en vigueur.

Article 10 — Archivage et accès permanent au contrat
Le présent contrat, une fois signé, est archivé de manière permanente par le Mandataire. Il reste consultable et téléchargeable à tout moment par le Mandant depuis son espace « Mes mandats », ainsi que par l'administration du Mandataire, à des fins de preuve, de suivi des garanties et de contrôle.

Signature électronique du Mandant : validation par code PIN à 4 chiffres, valant consentement au sens des usages du commerce électronique.`;
}
