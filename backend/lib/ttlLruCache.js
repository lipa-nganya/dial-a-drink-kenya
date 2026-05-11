/**
 * Small in-memory TTL cache with LRU eviction (Cloud Run: one map per instance).
 * Used for read-heavy public API responses; stale data bounded by ttlMs.
 */
class TtlLruCache {
  constructor(maxKeys, defaultTtlMs) {
    this.maxKeys = Math.max(1, maxKeys);
    this.defaultTtlMs = defaultTtlMs;
    /** @type {Map<string, { exp: number, value: unknown }>} */
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.exp) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxKeys) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, { value, exp: Date.now() + ttl });
  }

  clear() {
    this.map.clear();
  }
}

module.exports = { TtlLruCache };
