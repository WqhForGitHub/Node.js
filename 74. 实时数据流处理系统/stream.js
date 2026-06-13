// 流处理引擎 - 类似简化版 Spark Streaming/Flink
const EventEmitter = require('events');

// 数据流抽象
class Stream extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.operators = [];
    this.setMaxListeners(0);
  }

  // map: 转换每条数据
  map(fn) {
    const next = new Stream(`${this.name}.map`);
    this.on('data', (data) => {
      try { next.emit('data', fn(data)); }
      catch (e) { next.emit('error', e); }
    });
    return next;
  }

  // filter: 过滤
  filter(fn) {
    const next = new Stream(`${this.name}.filter`);
    this.on('data', (data) => {
      if (fn(data)) next.emit('data', data);
    });
    return next;
  }

  // 时间窗口聚合
  window(durationMs, aggregator) {
    const next = new Stream(`${this.name}.window`);
    let buffer = [];
    let windowStart = Date.now();
    const flush = () => {
      if (buffer.length > 0) {
        const result = aggregator(buffer, { start: windowStart, end: Date.now() });
        next.emit('data', result);
        buffer = [];
      }
      windowStart = Date.now();
    };
    setInterval(flush, durationMs);
    this.on('data', (data) => buffer.push(data));
    return next;
  }

  // 滑动窗口
  slidingWindow(sizeMs, slideMs, aggregator) {
    const next = new Stream(`${this.name}.sliding`);
    const buffer = [];
    this.on('data', (data) => {
      buffer.push({ data, ts: Date.now() });
    });
    setInterval(() => {
      const now = Date.now();
      while (buffer.length && now - buffer[0].ts > sizeMs) buffer.shift();
      if (buffer.length > 0) {
        const result = aggregator(buffer.map(x => x.data), { now, size: sizeMs });
        next.emit('data', result);
      }
    }, slideMs);
    return next;
  }

  // group by key
  groupBy(keyFn) {
    const groups = new Map();
    const getStream = (key) => {
      if (!groups.has(key)) groups.set(key, new Stream(`${this.name}.group:${key}`));
      return groups.get(key);
    };
    this.on('data', (data) => {
      const key = keyFn(data);
      getStream(key).emit('data', data);
    });
    return {
      stream: (key) => getStream(key),
      forEach: (fn) => {
        this.on('data', (data) => {
          const key = keyFn(data);
          fn(key, data, getStream(key));
        });
      }
    };
  }

  // 写入下游
  forEach(fn) {
    this.on('data', fn);
    return this;
  }

  // 输出到 sink
  to(sink) {
    this.on('data', (data) => sink.write(data));
    return this;
  }
}

// Sink: 输出端
class Sink {
  constructor(name, writer) {
    this.name = name;
    this.writer = writer;
  }
  write(data) { this.writer(data); }
}

// Source: 数据源
function createSource(name) {
  return new Stream(name);
}

// 内置聚合器
const aggregators = {
  count: (items) => ({ count: items.length, ts: Date.now() }),
  sum: (key) => (items) => ({
    sum: items.reduce((a, b) => a + (b[key] || 0), 0),
    count: items.length,
    ts: Date.now()
  }),
  avg: (key) => (items) => ({
    avg: items.reduce((a, b) => a + (b[key] || 0), 0) / items.length,
    count: items.length,
    ts: Date.now()
  }),
  topK: (key, k) => (items) => {
    const map = {};
    items.forEach(it => map[it[key]] = (map[it[key]] || 0) + 1);
    const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, k);
    return { top, ts: Date.now() };
  }
};

module.exports = { Stream, Sink, createSource, aggregators };
