// LRU 缓存 + TTL
class LRUCache {
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
    this.map = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) { this.stats.misses++; return undefined; }
    if (e.expireAt && Date.now() > e.expireAt) {
      this.map.delete(key);
      this.stats.misses++;
      return undefined;
    }
    // LRU 移到末尾
    this.map.delete(key);
    this.map.set(key, e);
    this.stats.hits++;
    return e.value;
  }

  set(key, value, ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    const expireAt = ttlMs ? Date.now() + ttlMs : null;
    this.map.set(key, { value, expireAt });
    this.stats.sets++;
    while (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
      this.stats.evictions++;
    }
  }

  del(key) { return this.map.delete(key); }
  has(key) {
    const e = this.map.get(key);
    if (!e) return false;
    if (e.expireAt && Date.now() > e.expireAt) { this.map.delete(key); return false; }
    return true;
  }
  size() { return this.map.size; }
  clear() { this.map.clear(); }
}

module.exports = LRUCache;
