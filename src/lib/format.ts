export function formatXOF(value: number): string {
  return new Intl.NumberFormat("fr-CI", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

export interface PricedProduct {
  cny_price: number;
  exchange_rate_cny_xof: number;
  logistics_fee_xof: number;
}

export function computePrice(p: PricedProduct): number {
  return Math.round(p.cny_price * p.exchange_rate_cny_xof + p.logistics_fee_xof);
}

export function computeProductCostXOF(p: PricedProduct): number {
  return Math.round(p.cny_price * p.exchange_rate_cny_xof);
}
