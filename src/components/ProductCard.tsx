import { Link } from "@tanstack/react-router";
import type { Product, Campaign } from "@/lib/queries";
import { computePrice, formatXOF } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import { CountdownTimer } from "./CountdownTimer";
import { Ship, Plane } from "lucide-react";

export function ProductCard({ product, campaign }: { product: Product; campaign?: Campaign }) {
  const price = computePrice(product);
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="group flex flex-col overflow-hidden rounded-xl bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-brand"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image_urls[0] ?? "/images/prod-drill.jpg"}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute right-2 top-2 rounded-md bg-secondary/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
          {product.category}
        </div>
        {campaign && (
          <div className="absolute left-2 top-2">
            <CountdownTimer endDate={campaign.end_date} compact />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{product.title}</h3>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-black text-primary">{formatXOF(price)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Import: {formatXOF(product.logistics_fee_xof)}
          </span>
        </div>
        {campaign && (
          <>
            <ProgressBar current={campaign.current_participants} target={campaign.target_quantity} />
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              {campaign.shipping_type === "sea" ? (
                <Ship className="h-3 w-3" />
              ) : (
                <Plane className="h-3 w-3" />
              )}
              {campaign.shipping_type === "sea" ? "Maritime" : "Aérien"} · {campaign.eta_days}j
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
