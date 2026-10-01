import type { ReactNode } from "react";
import { MapPin, Package, Phone, QrCode, User, X } from "lucide-react";

import { formatXOF } from "@/lib/format";
import {
  VIDA_ORDER_STATUS_CLASSES,
  VIDA_ORDER_STATUS_LABELS,
  vidaFormatOrderCode,
  vidaQrUrl,
  vidaVoucherPayload,
} from "@/lib/vida";

export type VidaOrderDetailData = {
  id: string;
  order_code: string;
  status: string;
  total_amount: number | string;
  delivery_fee: number | string;
  agent_commission?: number | string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  created_at?: string | null;
  product_title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  vida_products?: { title?: string | null } | null;
};

type Props = {
  order: VidaOrderDetailData | null;
  onClose: () => void;
  /** Actions spécifiques au rôle (prise en charge, validation OTP, encaissement…). */
  children?: ReactNode;
};

/** Fiche détail d'une commande ViDa (livreur / agent) : infos complètes + QR voucher
 *  que l'agent scanne pour verrouiller le dépôt. */
export function VidaOrderDetailSheet({ order, onClose, children }: Props) {
  if (!order) return null;
  const title = order.product_title ?? order.vida_products?.title ?? "Commande ViDa";
  const statusLabel = VIDA_ORDER_STATUS_LABELS[order.status] ?? order.status;
  const statusClass = VIDA_ORDER_STATUS_CLASSES[order.status] ?? "bg-muted text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm font-black">{title}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {vidaFormatOrderCode(order.order_code)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-muted p-1.5"
            aria-label="Fermer le détail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}
        >
          {statusLabel}
        </span>

        {/* QR voucher — l'agent le scanne pour verrouiller le dépôt */}
        <div className="mt-3 rounded-xl border border-border bg-background p-3 text-center">
          <p className="flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground">
            <QrCode className="h-3 w-3" /> QR voucher de la commande
          </p>
          <img
            src={vidaQrUrl(vidaVoucherPayload(order.order_code), 220)}
            alt={`QR voucher ${vidaFormatOrderCode(order.order_code)}`}
            className="mx-auto mt-2 h-44 w-44 rounded-lg bg-white p-1"
            loading="lazy"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Code voucher :{" "}
            <span className="font-mono font-black tracking-widest">
              {vidaFormatOrderCode(order.order_code)}
            </span>
          </p>
        </div>

        <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3 text-xs">
          <p className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-bold">{title}</span>
          </p>
          {order.client_name && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" /> {order.client_name}
              {order.client_phone ? ` · ${order.client_phone}` : ""}
            </p>
          )}
          {order.delivery_address && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {order.delivery_address}
            </p>
          )}
          {order.delivery_phone && (
            <a
              href={`tel:${order.delivery_phone}`}
              className="flex items-center gap-1.5 font-bold text-primary"
            >
              <Phone className="h-3.5 w-3.5" /> {order.delivery_phone}
            </a>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Montant total</span>
            <span className="font-black">{formatXOF(Number(order.total_amount))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Frais de livraison</span>
            <span className="font-bold">{formatXOF(Number(order.delivery_fee))}</span>
          </div>
          {order.agent_commission != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Commission agent</span>
              <span className="font-bold text-success">
                {formatXOF(Number(order.agent_commission))}
              </span>
            </div>
          )}
          {order.created_at && (
            <p className="text-[10px] text-muted-foreground">
              Créée le {new Date(order.created_at).toLocaleString("fr-FR")}
            </p>
          )}
        </div>

        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
