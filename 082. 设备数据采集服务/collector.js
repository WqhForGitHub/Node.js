// 数据采集器：批量缓冲 + 周期性持久化到时序文件
const fs = require('fs');
const path = require('path');

class Collector {
  constructor(opts = {}) {
    this.dir = opts.dir || path.join(__dirname, 'data');
    this.flushInterval = opts.flushInterval || 5000;
    this.batchSize = opts.batchSize || 100;
    this.buffer = [];
    this.stats = { received: 0, flushed: 0, errors: 0 };
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  ingest(point) {
    // point: { device, metric, value, ts? }
    if (!point || !point.device || !point.metric) {
      this.stats.errors++;
      return false;
    }
    point.ts = point.ts || Date.now();
    this.buffer.push(point);
    this.stats.received++;
    if (this.buffer.length >= this.batchSize) this.flush();
    return true;
  }

  // 按日期文件分片写入（line-delimited JSON）
  flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    // 按日期分组
    const groups = new Map();
    for (const p of batch) {
      const date = new Date(p.ts).toISOString().slice(0, 10);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(p);
    }
    for (const [date, points] of groups) {
      const file = path.join(this.dir, `${date}.ndjson`);
      const lines = points.map((p) => JSON.stringify(p)).join('\n') + '\n';
      try {
        fs.appendFileSync(file, lines);
        this.stats.flushed += points.length;
      } catch (e) {
        console.error('写入失败:', e.message);
        this.stats.errors++;
      }
    }
  }

  // 简单查询：按设备 + 时间段
  query({ device, metric, from, to, limit = 100 }) {
    this.flush();
    const results = [];
    const start = from ? new Date(from) : new Date(Date.now() - 86400000);
    const end = to ? new Date(to) : new Date();
    // 遍历日期文件
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const file = path.join(this.dir, `${date}.ndjson`);
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const p = JSON.parse(line);
          if (device && p.device !== device) continue;
          if (metric && p.metric !== metric) continue;
          if (p.ts < +start || p.ts > +end) continue;
          results.push(p);
          if (results.length >= limit) return results;
        } catch {}
      }
    }
    return results;
  }

  shutdown() {
    clearInterval(this.timer);
    this.flush();
  }
}

module.exports = Collector;
