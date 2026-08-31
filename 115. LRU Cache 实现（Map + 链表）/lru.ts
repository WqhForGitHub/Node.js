/**
 * LRU Cache 实现（Map + 双向链表）
 *
 * - get/put 均为 O(1)
 * - 容量满时淘汰最久未使用
 *
 * 运行：npx ts-node lru.ts
 */
interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export class LRUCache<K, V> {
  private map = new Map<K, Node<K, V>>();
  private head: Node<K, V>; // 最近使用
  private tail: Node<K, V>; // 最久未使用
  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error('capacity must > 0');
    this.head = { key: undefined as K, value: undefined as V, prev: null, next: null };
    this.tail = { key: undefined as K, value: undefined as V, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private remove(n: Node<K, V>) {
    n.prev!.next = n.next;
    n.next!.prev = n.prev;
    n.prev = n.next = null;
  }
  private addToHead(n: Node<K, V>) {
    n.next = this.head.next;
    n.prev = this.head;
    this.head.next!.prev = n;
    this.head.next = n;
  }

  get(key: K): V | undefined {
    const n = this.map.get(key);
    if (!n) return undefined;
    this.remove(n);
    this.addToHead(n);
    return n.value;
  }

  put(key: K, value: V): void {
    let n = this.map.get(key);
    if (n) {
      n.value = value;
      this.remove(n);
      this.addToHead(n);
      return;
    }
    n = { key, value, prev: null, next: null };
    this.map.set(key, n);
    this.addToHead(n);
    if (this.map.size > this.capacity) {
      const lru = this.tail.prev!;
      this.remove(lru);
      this.map.delete(lru.key);
    }
  }

  size() {
    return this.map.size;
  }
  keys(): K[] {
    const arr: K[] = [];
    let p = this.head.next;
    while (p && p !== this.tail) {
      arr.push(p.key);
      p = p.next;
    }
    return arr;
  }
}

// demo
const c = new LRUCache<string, number>(3);
c.put('a', 1);
c.put('b', 2);
c.put('c', 3);
console.log('keys:', c.keys()); // c b a
c.get('a');
console.log('keys:', c.keys()); // a c b
c.put('d', 4); // 淘汰 b
console.log('keys:', c.keys()); // d a c
console.log('b =', c.get('b')); // undefined
