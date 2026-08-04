import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DB, Order, Shop } from "./types";
import { DEFAULT_PRICES, DEMO_SHOP } from "./defaults";
import { isNetlify } from "./env";

// ---------------------------------------------------------------------------
// Local dev / traditional Node hosting: a JSON file on local disk, cached in
// module memory (fine — one long-lived process).
//
// Netlify: serverless functions have no durable local disk and no shared
// memory between invocations, so the same DB shape is instead read from and
// written to a single Netlify Blob on every call. Slightly slower per call,
// but actually correct across concurrent, isolated invocations. Everything
// below this line is environment-agnostic — callers just `await` these.
// ---------------------------------------------------------------------------

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DB_BLOB_KEY = "db.json";

function ensureDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function seed(): DB {
  return { shops: { [DEMO_SHOP.id]: { ...DEMO_SHOP } }, orders: [] };
}

// Local-only in-memory cache (unused on Netlify — every call re-reads the blob).
let cache: DB | null = null;

async function load(): Promise<DB> {
  if (isNetlify()) {
    const { dbStore } = await import("./blobs");
    const existing = await dbStore().get(DB_BLOB_KEY, { type: "json" });
    if (existing) return existing as DB;
    const fresh = seed();
    await dbStore().setJSON(DB_BLOB_KEY, fresh);
    return fresh;
  }

  if (cache) return cache;
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    cache = seed();
    persistLocal();
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
  } catch {
    cache = seed();
    persistLocal();
  }
  return cache!;
}

function persistLocal() {
  ensureDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
}

async function persist(db: DB): Promise<void> {
  if (isNetlify()) {
    const { dbStore } = await import("./blobs");
    await dbStore().setJSON(DB_BLOB_KEY, db);
    return;
  }
  cache = db;
  persistLocal();
}

export function id(): string {
  return crypto.randomUUID();
}

export async function getShop(shopId: string): Promise<Shop | undefined> {
  const db = await load();
  return db.shops[shopId];
}

export async function saveShop(shop: Shop): Promise<void> {
  const db = await load();
  db.shops[shop.id] = shop;
  await persist(db);
}

// No ambiguous characters (0/O, 1/I) so a code is easy to read off a wall poster.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function randomPasscode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Creates a brand-new, isolated shop with its own unique code (used as both
// the URL slug and the tenant key everything else filters by) and its own
// operator passcode. Two businesses never share a code or a passcode.
export async function createShop(name: string): Promise<Shop> {
  const db = await load();
  let code = randomCode(5);
  while (db.shops[code]) code = randomCode(5);

  const shop: Shop = {
    id: code,
    name: name.trim().slice(0, 80) || "My Print Shop",
    address: "",
    hours: "",
    isOpen: true,
    accepting: true,
    prices: { ...DEFAULT_PRICES },
    counter: 0,
    passcode: randomPasscode(),
  };
  db.shops[code] = shop;
  await persist(db);
  return shop;
}

export async function nextCode(shopId: string): Promise<string> {
  const db = await load();
  const shop = db.shops[shopId];
  shop.counter += 1;
  // Cycle a letter prefix every 100 orders so codes stay short and readable.
  const letter = String.fromCharCode(65 + Math.floor((shop.counter - 1) / 100) % 26);
  const n = ((shop.counter - 1) % 100) + 1;
  await persist(db);
  return `${letter}-${n}`;
}

export async function addOrder(order: Order): Promise<void> {
  const db = await load();
  db.orders.push(order);
  await persist(db);
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  const db = await load();
  return db.orders.find((o) => o.id === orderId);
}

export async function updateOrder(orderId: string, patch: Partial<Order>): Promise<Order | undefined> {
  const db = await load();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return undefined;
  Object.assign(o, patch);
  await persist(db);
  return o;
}

export async function activeOrders(shopId: string): Promise<Order[]> {
  const db = await load();
  return db.orders
    .filter((o) => o.shopId === shopId && o.status !== "deleted")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function allOrders(shopId: string): Promise<Order[]> {
  const db = await load();
  return db.orders.filter((o) => o.shopId === shopId);
}

export async function everyOrder(): Promise<Order[]> {
  const db = await load();
  return db.orders;
}

export async function allShopIds(): Promise<string[]> {
  const db = await load();
  return Object.keys(db.shops);
}

// Queue position among orders that are still waiting/printing, oldest first.
export async function queueAhead(shopId: string, orderId: string): Promise<number> {
  const active = await activeOrders(shopId);
  const q = active.filter((o) => o.status === "waiting" || o.status === "printing");
  const idx = q.findIndex((o) => o.id === orderId);
  return idx < 0 ? 0 : idx;
}
