import type { PriceTable, Shop } from "./types";

export const DEFAULT_PRICES: PriceTable = {
  a4_bw_single: 0.1,
  a4_bw_double: 0.15,
  a4_color_single: 0.4,
  a4_color_double: 0.7,
  a3_bw_single: 0.2,
  a3_bw_double: 0.3,
  a3_color_single: 0.8,
  a3_color_double: 1.4,
  binding_spiral: 2.0,
  binding_sleeve: 0.5,
  bulkThreshold: 50,
  bulkPerPage: 0, // 0 = disabled
  currency: "$",
};

// A single demo shop so the app is usable the moment it boots.
export const DEMO_SHOP: Shop = {
  id: "demo",
  name: "Main Street Copy & Print",
  address: "12 Main Street",
  hours: "Mon–Sat 09:00–19:00",
  isOpen: true,
  accepting: true,
  prices: { ...DEFAULT_PRICES },
  counter: 0,
  passcode: "1234",
};
