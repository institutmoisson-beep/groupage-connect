/** Modules délégables : chaque table/fonctionnalité de l'application peut être confiée
 * à un utilisateur qui obtient alors son tableau de bord et ses outils de gestion. */

export const STAFF_MODULES = [
  "users",
  "products",
  "campaigns",
  "orders",
  "hotels",
  "hotel_bookings",
  "payment_methods",
  "payment_proofs",
  "sourcing",
  "messages",
  "cargo",
  "stock",
  "onfaisimple",
  "vida_orders",
  "vida_delivery",
  "vida_products",
  "wallets",
  "withdrawals",
  "commissions",
  "logistics",
] as const;

export type StaffModule = (typeof STAFF_MODULES)[number];

type ModuleMeta = { label: string; hint: string; to: string };

export const STAFF_MODULE_META: Record<StaffModule, ModuleMeta> = {
  users: {
    label: "Utilisateurs & profils",
    hint: "Annuaire des comptes, profils et coordonnées.",
    to: "/admin/users",
  },
  products: {
    label: "Produits catalogue",
    hint: "Créer, modifier et désactiver les produits importés.",
    to: "/admin/products",
  },
  campaigns: {
    label: "Campagnes groupage",
    hint: "Campagnes mer/air, objectifs et statuts.",
    to: "/admin/campaigns",
  },
  orders: {
    label: "Commandes groupage",
    hint: "Suivi des commandes et changements de statut.",
    to: "/admin/orders",
  },
  hotels: {
    label: "Hôtels en direct",
    hint: "Fiches hôtels, chambres et disponibilités.",
    to: "/admin/hotels",
  },
  hotel_bookings: {
    label: "Réservations hôtel",
    hint: "Réservations clients et vouchers.",
    to: "/admin/hotel-bookings",
  },
  payment_methods: {
    label: "Moyens de paiement",
    hint: "Comptes Mobile Money, crypto, banque.",
    to: "/admin/payment-methods",
  },
  payment_proofs: {
    label: "Preuves de paiement",
    hint: "Vérification des dépôts manuels.",
    to: "/admin/proofs",
  },
  sourcing: {
    label: "Sourcing MSN",
    hint: "Devis, contrôle qualité et suivi des liens 1688/Taobao.",
    to: "/admin/sourcing",
  },
  messages: {
    label: "Messagerie clients",
    hint: "Conversations directes avec les utilisateurs.",
    to: "/admin/messages",
  },
  cargo: {
    label: "Cargo & Forwarding",
    hint: "Manifest colis Chine, poids/CBM et dispatch.",
    to: "/admin/cargo-packages",
  },
  stock: {
    label: "Stock Express",
    hint: "Produits en stock local, ventes et livreurs.",
    to: "/admin/stock",
  },
  onfaisimple: {
    label: "OnFaiSimple™",
    hint: "Lots de financement, dépôts et étapes.",
    to: "/admin/onfaisimple",
  },
  vida_orders: {
    label: "ViDa — Escrow",
    hint: "Fonds séquestrés, commissions et litiges.",
    to: "/admin/vida",
  },
  vida_delivery: {
    label: "ViDa — Livraisons",
    hint: "Affecter un livreur à chaque commande et suivre les courses.",
    to: "/admin/vida-delivery",
  },
  vida_products: {
    label: "ViDa — Produits & règles",
    hint: "Catalogue ViDa, commissions et règles d'annulation.",
    to: "/admin/vida-products",
  },
  wallets: {
    label: "Portefeuilles",
    hint: "Soldes, crédits et débits utilisateurs.",
    to: "/admin/wallets",
  },
  withdrawals: {
    label: "Retraits",
    hint: "Demandes de retrait et règlements.",
    to: "/admin/withdrawals",
  },
  commissions: {
    label: "Commissions MLM",
    hint: "Commissions générées par le réseau.",
    to: "/admin/commissions",
  },
  logistics: {
    label: "Compte MSN Logistics",
    hint: "Frais de livraison et journal logistique.",
    to: "/admin/logistics",
  },
};

/** Routes admin autorisées pour un module donné (utilisé pour filtrer la navigation admin). */
export const STAFF_MODULE_ROUTES: Record<StaffModule, string[]> = {
  users: ["/admin/users"],
  products: ["/admin/products", "/admin/campaign-products"],
  campaigns: ["/admin/campaigns", "/admin/campaign-products"],
  orders: ["/admin/orders"],
  hotels: ["/admin/hotels"],
  hotel_bookings: ["/admin/hotel-bookings"],
  payment_methods: ["/admin/payment-methods"],
  payment_proofs: ["/admin/proofs"],
  sourcing: ["/admin/sourcing"],
  messages: ["/admin/messages"],
  cargo: ["/admin/cargo", "/admin/cargo-packages", "/admin/cargo-dispatch"],
  stock: ["/admin/stock"],
  onfaisimple: ["/admin/onfaisimple"],
  vida_orders: ["/admin/vida"],
  vida_delivery: ["/admin/vida-delivery"],
  vida_products: ["/admin/vida-products", "/admin/vida-agents"],
  wallets: ["/admin/wallets"],
  withdrawals: ["/admin/withdrawals"],
  commissions: ["/admin/commissions"],
  logistics: ["/admin/logistics"],
};

export function moduleLabel(module: string): string {
  return STAFF_MODULE_META[module as StaffModule]?.label ?? module;
}
