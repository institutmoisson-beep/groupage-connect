import { formatMoney } from "./currency";

// Hydration-safe: Intl's XOF symbol differs between server and browser ICU data.
export function formatXOF(value: number): string {
  return formatMoney(value, "XOF");
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
