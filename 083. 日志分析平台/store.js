// 日志存储 + 索引
const fs = require('fs');
const path = require('path');

class LogStore {
  constructor(dir = path.join(__dirname, 'logs')) {
    this.dir = dir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // 内存索引：最近 10000 条
    this.recent = [];
    this.maxRecent = 10000;
    // 聚合统计
    this.counters = {
      byLevel: { info: 0, warn: 0, error: 0, debug: 0 },
      bySource: new Map(),
      byMinute: new Map(), // YYYY-MM-DDTHH:MM => count
    };
  }

  add(entry) {
    if (!entry) return;
    this.recent.push(entry);
    if (this.recent.length > this.maxRecent) this.recent.shift();

    // 聚合
    const lvl = (entry.level || 'info').toLowerCase();
    this.counters.byLevel[lvl] = (this.counters.byLevel[lvl] || 0) + 1;
    if (entry.source) {
      this.counters.bySource.set(entry.source, (this.counters.bySource.get(entry.source) || 0) + 1);
    }
    const minute = new Date(entry.ts).toISOString().slice(0, 16);
    this.counters.byMinute.set(minute, (this.counters.byMinute.get(minute) || 0) + 1);

    // 持久化（按日期）
    const date = new Date(entry.ts).toISOString().slice(0, 10);
    fs.appendFileSync(path.join(this.dir, `${date}.ndjson`), JSON.stringify(entry) + '\n');
  }

  // 搜索：支持文本、级别、来源过滤
  search({ q, level, source, limit = 100 }) {
    const results = [];
    const re = q ? new RegExp(q, 'i') : null;
    // 倒序搜索最近日志
    for (let i = this.recent.length - 1; i >= 0 && results.length < limit; i--) {
      const e = this.recent[i];
      if (level && e.level !== level) continue;
      if (source && e.source !== source) continue;
      if (re && !re.test(JSON.stringify(e))) continue;
      results.push(e);
    }
    return results;
  }

  stats() {
    // 取最近 60 分钟的趋势
    const now = Date.now();
    const trend = [];
    for (let i = 59; i >= 0; i--) {
      const t = new Date(now - i * 60000).toISOString().slice(0, 16);
      trend.push({ minute: t, count: this.counters.byMinute.get(t) || 0 });
    }
    return {
      byLevel: this.counters.byLevel,
      topSources: [...this.counters.bySource.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => ({ source: k, count: v })),
      trend,
      total: this.recent.length,
    };
  }
}

module.exports = LogStore;
