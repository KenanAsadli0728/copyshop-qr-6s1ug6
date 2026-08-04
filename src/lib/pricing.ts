import type { OrderOptions, PriceTable } from "./types";

// Returns the per-page rate for a given size/color/duplex combination.
export function perPageRate(prices: PriceTable, opts: OrderOptions): number {
  const size = opts.paper === "A3" ? "a3" : "a4";
  const color = opts.color ? "color" : "bw";
  const side = opts.duplex ? "double" : "single";
  const key = `${size}_${color}_${side}` as keyof PriceTable;
  return (prices[key] as number) ?? 0;
}

export interface Quote {
  pages: number; // single copy
  billedPages: number; // pages * copies
  perPage: number;
  bulkApplied: boolean;
  bindingCost: number;
  price: number;
}

// pages = document page count for a single copy (already respecting page range).
export function quote(prices: PriceTable, opts: OrderOptions, pages: number): Quote {
  const copies = Math.max(1, opts.copies);
  const billedPages = pages * copies;

  let perPage = perPageRate(prices, opts);
  let bulkApplied = false;
  if (prices.bulkPerPage > 0 && billedPages > prices.bulkThreshold) {
    perPage = prices.bulkPerPage;
    bulkApplied = true;
  }

  const binding =
    opts.binding === "spiral"
      ? prices.binding_spiral
      : opts.binding === "sleeve"
      ? prices.binding_sleeve
      : 0;
  const bindingCost = binding * copies;

  const price = round2(billedPages * perPage + bindingCost);
  return { pages, billedPages, perPage, bulkApplied, bindingCost, price };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(prices: PriceTable, n: number): string {
  return `${prices.currency}${n.toFixed(2)}`;
}
