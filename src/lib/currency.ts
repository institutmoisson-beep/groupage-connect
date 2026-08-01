/**
 * Hydration-safe money formatting.
 *
 * `Intl.NumberFormat` currency display for XOF differs between the Worker ICU
 * data ("XOF") and browsers ("F CFA"), which caused an SSR/CSR mismatch.
 * We format digits with a fixed locale-independent grouping and append our own
 * currency label, so server and client always render identical markup.
 */

export const SUPPORTED_CURRENCIES = ["XOF", "EUR", "USD", "CNY", "GBP"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  XOF: "FCFA",
  EUR: "€",
  USD: "$",
  CNY: "¥",
  GBP: "£",
};

/** Fallback rates (1 XOF -> currency) used until the database cache is loaded. */
export const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  XOF: 1,
  EUR: 0.001524,
  USD: 0.00165,
  CNY: 0.0119,
  GBP: 0.00129,
};

const DECIMALS: Record<SupportedCurrency, number> = {
  XOF: 0,
  EUR: 2,
  USD: 2,
  CNY: 2,
  GBP: 2,
};

function groupDigits(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  const sign = value < 0 ? "-" : "";
  return decPart ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

export function formatMoney(amount: number, currency: SupportedCurrency = "XOF"): string {
  const decimals = DECIMALS[currency];
  return `${groupDigits(amount, decimals)}\u00A0${CURRENCY_LABELS[currency]}`;
}

export function convertFromXof(
  amountXof: number,
  currency: SupportedCurrency,
  rates: Partial<Record<SupportedCurrency, number>> = FALLBACK_RATES,
): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency];
  return amountXof * rate;
}

export function formatFromXof(
  amountXof: number,
  currency: SupportedCurrency,
  rates?: Partial<Record<SupportedCurrency, number>>,
): string {
  return formatMoney(convertFromXof(amountXof, currency, rates), currency);
}
