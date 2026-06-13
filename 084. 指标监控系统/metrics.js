// 指标类型：Counter / Gauge / Histogram
class Counter {
  constructor() { this.value = 0; this.labels = new Map(); }
  inc(labels = {}, n = 1) {
    const key = JSON.stringify(labels);
    this.labels.set(key, (this.labels.get(key) || 0) + n);
    this.value += n;
  }
  snapshot() {
    return { type: 'counter', value: this.value, labels: [...this.labels] };
  }
}

class Gauge {
  constructor() { this.value = 0; this.labels = new Map(); }
  set(labels = {}, v) {
    const key = JSON.stringify(labels);
    this.labels.set(key, v);
    this.value = v;
  }
  inc(labels, n = 1) { this.set(labels, (this.value || 0) + n); }
  dec(labels, n = 1) { this.set(labels, (this.value || 0) - n); }
  snapshot() { return { type: 'gauge', value: this.value, labels: [...this.labels] }; }
}

class Histogram {
  constructor(buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000]) {
    this.buckets = buckets;
    this.counts = new Array(buckets.length + 1).fill(0);
    this.sum = 0;
    this.count = 0;
    this.values = []; // 用于 percentile
  }
  observe(v) {
    this.sum += v;
    this.count++;
    let placed = false;
    for (let i = 0; i < this.buckets.length; i++) {
      if (v <= this.buckets[i]) { this.counts[i]++; placed = true; break; }
    }
    if (!placed) this.counts[this.counts.length - 1]++;
    this.values.push(v);
    if (this.values.length > 1000) this.values.shift();
  }
  percentile(p) {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor((p / 100) * (sorted.length - 1))];
  }
  snapshot() {
    return {
      type: 'histogram',
      count: this.count,
      sum: this.sum,
      avg: this.count ? this.sum / this.count : 0,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
      buckets: this.buckets.map((b, i) => ({ le: b, count: this.counts[i] }))
    };
  }
}

class Registry {
  constructor() { this.metrics = new Map(); }
  counter(name) {
    if (!this.metrics.has(name)) this.metrics.set(name, new Counter());
    return this.metrics.get(name);
  }
  gauge(name) {
    if (!this.metrics.has(name)) this.metrics.set(name, new Gauge());
    return this.metrics.get(name);
  }
  histogram(name, buckets) {
    if (!this.metrics.has(name)) this.metrics.set(name, new Histogram(buckets));
    return this.metrics.get(name);
  }
  snapshot() {
    const out = {};
    for (const [k, v] of this.metrics) out[k] = v.snapshot();
    return out;
  }
  // Prometheus 文本格式
  prometheus() {
    let out = '';
    for (const [name, m] of this.metrics) {
      const safe = name.replace(/[^a-z0-9_]/gi, '_');
      if (m instanceof Counter) {
        out += `# TYPE ${safe} counter\n${safe} ${m.value}\n`;
      } else if (m instanceof Gauge) {
        out += `# TYPE ${safe} gauge\n${safe} ${m.value}\n`;
      } else if (m instanceof Histogram) {
        out += `# TYPE ${safe} histogram\n`;
        for (let i = 0; i < m.buckets.length; i++) {
          out += `${safe}_bucket{le="${m.buckets[i]}"} ${m.counts[i]}\n`;
        }
        out += `${safe}_sum ${m.sum}\n${safe}_count ${m.count}\n`;
      }
    }
    return out;
  }
}

module.exports = { Counter, Gauge, Histogram, Registry };
