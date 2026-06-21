// Basit in-memory TTL cache modülü.
// Aynı koordinat için 10 dakika içinde API'ye tekrar istek atılmasını önler.

type CacheEntry<T> = { data: T; ts: number };

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  /** Varsa ve süresi dolmamışsa cache'teki veriyi döner, yoksa null. */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  /** Veriyi cache'e yazar. */
  set(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  /** Belirli bir anahtarı cache'ten siler. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Tüm cache'i temizler. */
  clear(): void {
    this.store.clear();
  }
}
