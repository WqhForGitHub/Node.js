// 一致性哈希环
const crypto = require('crypto');

class ConsistentHash {
  constructor(virtualNodes = 150) {
    this.virtualNodes = virtualNodes;
    this.ring = []; // [{hash, node}] 排序
    this.nodes = new Set();
  }

  hash(key) {
    const h = crypto.createHash('md5').update(key).digest();
    return h.readUInt32BE(0);
  }

  addNode(node) {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);
    for (let i = 0; i < this.virtualNodes; i++) {
      this.ring.push({ hash: this.hash(`${node}#${i}`), node });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  removeNode(node) {
    this.nodes.delete(node);
    this.ring = this.ring.filter(e => e.node !== node);
  }

  getNode(key) {
    if (this.ring.length === 0) return null;
    const h = this.hash(key);
    // 二分查找第一个 >= h 的节点
    let lo = 0, hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ring[mid].hash < h) lo = mid + 1; else hi = mid;
    }
    return this.ring[this.ring[lo].hash >= h ? lo : 0].node;
  }

  // 获取 N 个不同节点（用于副本）
  getNodes(key, n) {
    if (this.ring.length === 0) return [];
    const h = this.hash(key);
    const result = [];
    const seen = new Set();
    let lo = 0, hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ring[mid].hash < h) lo = mid + 1; else hi = mid;
    }
    let idx = this.ring[lo].hash >= h ? lo : 0;
    while (result.length < n && result.length < this.nodes.size) {
      const node = this.ring[idx].node;
      if (!seen.has(node)) { seen.add(node); result.push(node); }
      idx = (idx + 1) % this.ring.length;
    }
    return result;
  }
}

module.exports = ConsistentHash;
