import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, id } from "./store";
import { isNetlify } from "./env";

// Files are uploaded ONCE to a staging area so the customer gets an accurate,
// server-computed page count before committing — then the order is created
// from these same bytes, no second upload (important on 3G).
//
// Local dev: an in-memory Map + real temp files on disk (unchanged from
// before Netlify support).
// Netlify: metadata as a JSON blob, file bytes as separate blobs — since the
// commit step (a day-old customer's next click) may hit an entirely
// different serverless invocation than the one that staged the upload.

export interface StagedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  rawPages: number; // full page count of the file (before any page range)
  convertPending: boolean;
}

export interface Staged {
  id: string;
  shopId: string;
  files: StagedFile[];
  createdAt: number;
}

const TTL = 30 * 60 * 1000; // staged uploads live 30 min max
const STAGE_DIR = path.join(DATA_DIR, "staged");

interface LocalStaged extends Staged {
  dir: string;
}
const g = globalThis as unknown as { __copyshopStage?: Map<string, LocalStaged> };
const localStaging = g.__copyshopStage ?? (g.__copyshopStage = new Map());

function stageDir(): string {
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  return STAGE_DIR;
}

export async function createStaged(shopId: string): Promise<Staged> {
  const sid = id();
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const s: Staged = { id: sid, shopId, files: [], createdAt: Date.now() };
    await stagingStore().setJSON(`${sid}.json`, s);
    return s;
  }
  const dir = path.join(stageDir(), sid);
  fs.mkdirSync(dir, { recursive: true });
  const s: LocalStaged = { id: sid, shopId, dir, files: [], createdAt: Date.now() };
  localStaging.set(sid, s);
  return s;
}

export async function addStagedFile(quoteId: string, file: StagedFile, buf: Buffer): Promise<void> {
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const meta = (await stagingStore().get(`${quoteId}.json`, { type: "json" })) as Staged | null;
    if (!meta) return;
    meta.files.push(file);
    await stagingStore().set(`${quoteId}/${file.id}`, new Blob([new Uint8Array(buf)]));
    await stagingStore().setJSON(`${quoteId}.json`, meta);
    return;
  }
  const s = localStaging.get(quoteId);
  if (!s) return;
  fs.writeFileSync(path.join(s.dir, file.id), buf);
  s.files.push(file);
}

export async function getStaged(quoteId: string): Promise<Staged | undefined> {
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const meta = (await stagingStore().get(`${quoteId}.json`, { type: "json" })) as Staged | null;
    if (!meta) return undefined;
    if (Date.now() - meta.createdAt > TTL) {
      await discardStaged(quoteId);
      return undefined;
    }
    return meta;
  }
  const s = localStaging.get(quoteId);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > TTL) {
    await discardStaged(quoteId);
    return undefined;
  }
  return s;
}

// Reads back one staged file's raw bytes — used only when committing into a
// real order, so the bytes never need a second network round-trip from the
// customer's device.
export async function readStagedFileBytes(quoteId: string, fileId: string): Promise<Buffer | null> {
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const data = await stagingStore().get(`${quoteId}/${fileId}`, { type: "arrayBuffer" });
    return data ? Buffer.from(data) : null;
  }
  const s = localStaging.get(quoteId);
  if (!s) return null;
  try {
    return fs.readFileSync(path.join(s.dir, fileId));
  } catch {
    return null;
  }
}

export async function discardStaged(quoteId: string): Promise<void> {
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const meta = (await stagingStore().get(`${quoteId}.json`, { type: "json" })) as Staged | null;
    await stagingStore().delete(`${quoteId}.json`);
    if (meta) await Promise.all(meta.files.map((f) => stagingStore().delete(`${quoteId}/${f.id}`)));
    return;
  }
  const s = localStaging.get(quoteId);
  if (!s) return;
  try {
    fs.rmSync(s.dir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
  localStaging.delete(quoteId);
}

// Sweep expired staged uploads (called from retention).
export async function sweepStaged(): Promise<void> {
  if (isNetlify()) {
    const { stagingStore } = await import("./blobs");
    const { blobs } = await stagingStore().list();
    const now = Date.now();
    for (const b of blobs) {
      if (!b.key.endsWith(".json")) continue;
      const meta = (await stagingStore().get(b.key, { type: "json" })) as Staged | null;
      if (meta && now - meta.createdAt > TTL) await discardStaged(meta.id);
    }
    return;
  }
  const now = Date.now();
  for (const [sid, s] of localStaging) {
    if (now - s.createdAt > TTL) await discardStaged(sid);
  }
}
