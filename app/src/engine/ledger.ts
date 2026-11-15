export interface LedgerEntry { index: number; time: number; type: string; payload: unknown; prev: string; hash: string }

async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const GENESIS = "0".repeat(64);
const body = (e: Omit<LedgerEntry, "hash">) => JSON.stringify([e.index, e.time, e.type, e.payload, e.prev]);

/** Append-only hash chain. Any edit to any past entry breaks every hash after it. */
export class Ledger {
  entries: LedgerEntry[] = [];
  async append(type: string, payload: unknown, time = Date.now()): Promise<LedgerEntry> {
    const prev = this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS;
    const draft = { index: this.entries.length, time, type, payload, prev };
    const entry = { ...draft, hash: await sha256(body(draft)) };
    this.entries.push(entry);
    return entry;
  }
  /** Returns the index of the first bad entry, or -1 when the whole chain verifies. */
  async verify(entries: LedgerEntry[] = this.entries): Promise<number> {
    let prev = GENESIS;
    for (const e of entries) {
      const { hash, ...draft } = e;
      if (e.prev !== prev || (await sha256(body(draft))) !== hash) return e.index;
      prev = hash;
    }
    return -1;
  }
}
