/**
 * DNS 缓存用的简易 LRU（演示复用 115 示例的思路）
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}
  get(k: K): V | undefined {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k)!;
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }
  put(k: K, v: V) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.capacity) {
      const first = this.map.keys().next().value as K;
      this.map.delete(first);
    }
  }
  size() {
    return this.map.size;
  }
}
