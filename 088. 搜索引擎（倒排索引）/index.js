// 倒排索引 + BM25 评分
const Tokenizer = require('./tokenizer');

class InvertedIndex {
  constructor() {
    // term => { df: 文档频率, postings: Map(docId => {tf, positions}) }
    this.index = new Map();
    // docId => { fields, length, tokens }
    this.docs = new Map();
    this.totalLength = 0;
    this.docIdCounter = 1;

    // BM25 参数
    this.k1 = 1.5;
    this.b = 0.75;
  }

  addDocument(doc, fields = ['title', 'body']) {
    const id = doc.id !== undefined ? doc.id : this.docIdCounter++;
    if (this.docs.has(id)) this.removeDocument(id);

    // 合并所有可搜索字段
    const text = fields.map((f) => doc[f] || '').join(' ');
    const tokens = Tokenizer.analyze(text);
    const tf = new Map();
    const positions = new Map();
    tokens.forEach((tok, pos) => {
      tf.set(tok, (tf.get(tok) || 0) + 1);
      if (!positions.has(tok)) positions.set(tok, []);
      positions.get(tok).push(pos);
    });

    this.docs.set(id, { doc, length: tokens.length, tokens });
    this.totalLength += tokens.length;

    for (const [term, count] of tf) {
      if (!this.index.has(term)) this.index.set(term, { df: 0, postings: new Map() });
      const entry = this.index.get(term);
      entry.df++;
      entry.postings.set(id, { tf: count, positions: positions.get(term) });
    }
    return id;
  }

  removeDocument(id) {
    const docInfo = this.docs.get(id);
    if (!docInfo) return false;
    this.totalLength -= docInfo.length;
    for (const [term, entry] of this.index) {
      if (entry.postings.has(id)) {
        entry.postings.delete(id);
        entry.df--;
        if (entry.df === 0) this.index.delete(term);
      }
    }
    this.docs.delete(id);
    return true;
  }

  // BM25 搜索
  search(query, options = {}) {
    const limit = options.limit || 10;
    const queryTerms = Tokenizer.analyze(query);
    if (queryTerms.length === 0) return [];

    const N = this.docs.size;
    const avgdl = N > 0 ? this.totalLength / N : 1;
    const scores = new Map(); // docId => score
    const matchedTerms = new Map(); // docId => Set(terms)

    for (const term of queryTerms) {
      const entry = this.index.get(term);
      if (!entry) continue;
      // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((N - entry.df + 0.5) / (entry.df + 0.5) + 1);
      for (const [docId, posting] of entry.postings) {
        const docInfo = this.docs.get(docId);
        const tf = posting.tf;
        const dl = docInfo.length;
        const score =
          (idf * (tf * (this.k1 + 1))) / (tf + this.k1 * (1 - this.b + (this.b * dl) / avgdl));
        scores.set(docId, (scores.get(docId) || 0) + score);
        if (!matchedTerms.has(docId)) matchedTerms.set(docId, new Set());
        matchedTerms.get(docId).add(term);
      }
    }

    const results = [...scores.entries()]
      .map(([id, score]) => ({
        id,
        score,
        doc: this.docs.get(id).doc,
        matched: [...matchedTerms.get(id)],
        snippet: this.snippet(this.docs.get(id).doc, queryTerms),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  // 生成摘要：包含关键词的片段
  snippet(doc, terms, maxLen = 120) {
    const text = (doc.body || doc.title || '').toString();
    if (!text) return '';
    const lower = text.toLowerCase();
    let pos = -1;
    for (const t of terms) {
      const i = lower.indexOf(t);
      if (i >= 0 && (pos === -1 || i < pos)) pos = i;
    }
    if (pos === -1) return text.slice(0, maxLen);
    const start = Math.max(0, pos - 30);
    const end = Math.min(text.length, start + maxLen);
    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
  }

  stats() {
    return {
      documents: this.docs.size,
      terms: this.index.size,
      totalTokens: this.totalLength,
      avgDocLength: this.docs.size ? this.totalLength / this.docs.size : 0,
    };
  }
}

module.exports = InvertedIndex;
