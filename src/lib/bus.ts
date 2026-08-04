import { EventEmitter } from "node:events";

// Process-wide event bus so the operator queue and customer status pages get
// pushed updates over SSE without polling. One process = one bus (MVP).
type Listener = (data: unknown) => void;

const g = globalThis as unknown as { __copyshopBus?: EventEmitter };
const bus = g.__copyshopBus ?? (g.__copyshopBus = new EventEmitter());
bus.setMaxListeners(0);

function channel(shopId: string) {
  return `shop:${shopId}`;
}

export function publish(shopId: string, event: { type: string; [k: string]: unknown }) {
  bus.emit(channel(shopId), event);
}

export function subscribe(shopId: string, listener: Listener): () => void {
  bus.on(channel(shopId), listener);
  return () => bus.off(channel(shopId), listener);
}
