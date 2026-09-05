// 离线演示：直接调用搜索引擎
const InvertedIndex = require('./index');

const idx = new InvertedIndex();

const docs = [
  {
    id: 1,
    title: 'Node.js Streams',
    body: 'Streams are a way to handle reading and writing data efficiently in Node.js.',
  },
  {
    id: 2,
    title: 'JavaScript Closures',
    body: 'Closures allow inner functions to access outer function variables in JavaScript.',
  },
  {
    id: 3,
    title: 'Search Engines',
    body: 'Search engines use inverted indexes to quickly find documents matching queries.',
  },
  {
    id: 4,
    title: 'BM25 Ranking',
    body: 'BM25 ranking improves on TF-IDF with document length normalization.',
  },
  { id: 5, title: '分布式存储', body: '分布式存储系统通过分片和复制实现高可用与扩展性。' },
  { id: 6, title: 'V8 引擎', body: 'V8 是 Google 开发的高性能 JavaScript 引擎。' },
];

for (const d of docs) idx.addDocument(d);

console.log('索引统计:', idx.stats());

const queries = ['javascript', 'search index', 'distributed', '分布式', 'BM25 ranking documents'];
for (const q of queries) {
  console.log(`\n=== 查询: "${q}" ===`);
  const results = idx.search(q, { limit: 3 });
  for (const r of results) {
    console.log(`[${r.score.toFixed(3)}] ${r.doc.title}`);
    console.log(`     命中: ${r.matched.join(', ')}`);
    console.log(`     ${r.snippet}`);
  }
}
