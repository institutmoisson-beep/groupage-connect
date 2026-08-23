/** Constantes, libellés et helpers partagés du module ViDa (Escrow E-Commerce & Delivery). */

export const VIDA_ORDER_STATUS_LABELS: Record<string, string> = {
  pending_deposit: "En attente de dépôt agent",
  funds_locked: "Fonds verrouillés en séquestre",
  in_transit: "En livraison",
  delivered: "Livré & payé",
  cancelled_pending_refund: "Annulée — remboursement en attente",
  refunded: "Remboursée",
  disputed: "Litige",
};

export const VIDA_ORDER_STATUS_CLASSES: Record<string, string> = {
  pending_deposit: "bg-muted text-muted-foreground",
  funds_locked: "bg-secondary text-secondary-foreground",
  in_transit: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
  cancelled_pending_refund: "bg-destructive/20 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  disputed: "bg-destructive text-destructive-foreground",
};

export const VIDA_RECOVERY_MODE_LABELS: Record<string, string> = {
  AUTO_LOOP: "Auto-boucle (paiements Vendeur/Livreur)",
  API_TOPUP: "Recharge API (Wave / MTN / Orange Money)",
  PHYSICAL_COLLECT: "Collecte physique (agent terrain)",
};

export const VIDA_RECOVERY_MODE_HINTS: Record<string, string> = {
  AUTO_LOOP:
    "Le cash de l'agent sert directement à payer les vendeurs/livreurs qui retirent en espèces ; le float virtuel est restauré automatiquement.",
  API_TOPUP:
    "Quand le cash-in-hand atteint la limite, l'agent transfère par Mobile Money vers le compte marchand ViDa ; le float est recrédité au webhook.",
  PHYSICAL_COLLECT:
    "Un collecteur terrain vient récupérer le cash chez l'agent et confirme la réception via QR dans l'app Admin.",
};

export const VIDA_PAYMENT_CHANNEL_LABELS: Record<string, string> = {
  agent_cash: "Espèces chez un Agent Mobile Money",
  mobile_money_online: "Mobile Money en ligne",
};

/** Même service QR déjà utilisé par le module OnFaiSimple (src/lib/onfaisimple.ts) — pas de dépendance npm ajoutée. */
export function vidaQrUrl(payload: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(payload)}`;
}

export function vidaFormatOrderCode(code: string): string {
  return code.toUpperCase().replace(/(.{4})(.{4})/, "$1-$2");
}

/** Construit la charge utile encodée dans le QR code voucher client (dépôt) ou remboursement. */
export function vidaVoucherPayload(
  orderCode: string,
  kind: "deposit" | "refund" = "deposit",
): string {
  return JSON.stringify({ app: "vida", kind, code: orderCode });
}

export function vidaCountdownLabel(deadline: string | null): string {
  if (!deadline) return "—";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Délai expiré";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min restantes` : `${m} min restantes`;
}

export function vidaIsCancellable(status: string, deadline: string | null): boolean {
  if (status === "pending_deposit") return true;
  if (status !== "funds_locked") return false;
  if (!deadline) return true;
  return new Date(deadline).getTime() > Date.now();
}
