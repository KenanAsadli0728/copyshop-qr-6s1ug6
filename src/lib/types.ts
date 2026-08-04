export type Paper = "A4" | "A3";
export type Binding = "none" | "spiral" | "sleeve";
export type OrderStatus = "waiting" | "printing" | "ready" | "cancelled" | "deleted";

export interface OrderOptions {
  color: boolean; // true = color, false = B&W
  duplex: boolean; // true = double-sided
  copies: number;
  paper: Paper;
  binding: Binding;
  pageRange?: string; // e.g. "3-7, 12"
}

export interface OrderFile {
  id: string;
  name: string;
  size: number; // bytes
  type: string; // mime
  rawPages: number; // full document page count, unaffected by page range
  pages: number; // resolved page count under the order's current options (page range applied)
  storedPath: string; // absolute path on local disk
  convertPending: boolean; // true when an office format needs server-side PDF conversion (stubbed)
}

export interface Order {
  id: string;
  shopId: string;
  code: string; // e.g. "A-47"
  firstName?: string;
  files: OrderFile[];
  fileCount: number; // persists after retention clears `files`, so history can still say "2 files"
  options: OrderOptions;
  pages: number; // total document pages across files (single copy)
  billedPages: number; // pages * copies
  price: number;
  status: OrderStatus;
  createdAt: number;
  printedAt?: number;
  deletedAt?: number;
}

export interface PriceTable {
  // per-page rates
  a4_bw_single: number;
  a4_bw_double: number;
  a4_color_single: number;
  a4_color_double: number;
  a3_bw_single: number;
  a3_bw_double: number;
  a3_color_single: number;
  a3_color_double: number;
  // binding, flat per copy
  binding_spiral: number;
  binding_sleeve: number;
  // volume discount
  bulkThreshold: number; // pages
  bulkPerPage: number; // replacement per-page rate when over threshold (0 = disabled)
  currency: string; // symbol, e.g. "$"
}

export interface Shop {
  id: string; // the shop's unique code, e.g. "7F3K2" — also its URL slug
  name: string;
  address: string;
  hours: string;
  isOpen: boolean; // manual open/closed
  accepting: boolean; // pause new orders toggle
  prices: PriceTable;
  counter: number; // last order number issued
  passcode: string; // gates this shop's /dashboard/[shopId] only — never the public kiosk
}

export interface DB {
  shops: Record<string, Shop>;
  orders: Order[];
}
