/**
 * BFF 缓存层 (Cache Layer)
 *
 * 功能：
 * - 内存缓存，减少对后端服务的重复请求
 * - TTL 过期机制
 * - LRU 淘汰策略
 * - 缓存统计
 */

class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 200;
    this.defaultTTL = options.defaultTTL || 30000; // 默认 30 秒
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  /**
   * 生成缓存 key
   */
  static key(service, path, params = "") {
    return `${service}:${path}:${params}`;
  }

  /**
   * 获取缓存
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    // 检查是否过期
    if (Date.now() > entry.expireAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    // LRU: 移到末尾（最近使用）
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits++;
    return entry.data;
  }

  /**
   * 设置缓存
   */
  set(key, data, ttl) {
    const effectiveTTL = ttl !== undefined ? ttl : this.defaultTTL;

    // 容量淘汰
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }

    this.store.set(key, {
      data,
      expireAt: Date.now() + effectiveTTL,
      createdAt: Date.now(),
    });
    this.stats.sets++;
  }

  /**
   * 删除缓存（支持前缀匹配）
   */
  delete(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 清空缓存
   */
  clear() {
    this.store.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      maxSize: this.maxSize,
      hitRate:
        total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + "%" : "N/A",
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expireAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// 定时清理过期缓存
const cache = new Cache({ maxSize: 200, defaultTTL: 30000 });
setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] 清理过期缓存: ${cleaned} 条`);
  }
}, 60000);

module.exports = { Cache, cache };
