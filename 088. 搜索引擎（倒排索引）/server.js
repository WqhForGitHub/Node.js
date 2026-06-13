// 搜索引擎 HTTP 服务
const http = require('http');
const url = require('url');
const InvertedIndex = require('./index');

const PORT = 7800;
const idx = new InvertedIndex();

// 预加载示例文档
const samples = [
  { id: 1, title: 'Node.js 入门', body: 'Node.js 是基于 V8 的 JavaScript 运行时，适合构建高性能网络应用。' },
  { id: 2, title: 'Inverted Index', body: 'An inverted index is the core data structure used by search engines to map terms to documents.' },
  { id: 3, title: 'BM25 算法', body: 'BM25 是一种基于概率检索模型的相关性评分函数，常用于全文搜索。' },
  { id: 4, title: 'TF-IDF', body: 'TF-IDF 衡量词语对文档的重要性，由词频和逆文档频率两部分组成。' },
  { id: 5, title: '分布式系统', body: 'Distributed systems involve multiple machines cooperating to provide a service.' },
  { id: 6, title: 'JavaScript 性能优化', body: 'JavaScript performance optimization techniques include caching, lazy loading, code splitting and avoiding memory leaks.' },
  { id: 7, title: 'HTTP 协议详解', body: 'HTTP 是无状态的应用层协议，建立在 TCP 之上，用于客户端与服务器之间的通信。' },
  { id: 8, title: '搜索引擎原理', body: '现代搜索引擎包含爬虫、索引、排序、查询解析等多个核心模块。倒排索引是其中最关键的数据结构。' }
];
for (const s of samples) idx.addDocument(s);
console.log(`已索引 ${samples.length} 篇示例文档`);

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'POST' && u.pathname === '/index') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const docs = Array.isArray(data) ? data : [data];
        const ids = docs.map(d => idx.addDocument(d));
        res.end(JSON.stringify({ ok: true, ids }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/search') {
    const q = u.query.q || '';
    const limit = parseInt(u.query.limit || '10');
    const results = idx.search(q, { limit });
    res.end(JSON.stringify({ query: q, total: results.length, results }));
    return;
  }

  if (req.method === 'DELETE') {
    const m = u.pathname.match(/^\/doc\/(.+)$/);
    if (m) {
      const id = isNaN(m[1]) ? m[1] : parseInt(m[1]);
      res.end(JSON.stringify({ ok: idx.removeDocument(id) }));
      return;
    }
  }

  if (req.method === 'GET' && u.pathname === '/stats') {
    res.end(JSON.stringify(idx.stats()));
    return;
  }

  if (req.method === 'GET' && u.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>搜索引擎</title>
<style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:auto}input{width:60%;padding:8px}.r{padding:10px;border-bottom:1px solid #eee}.t{font-weight:bold;color:#1a0dab;font-size:18px}.s{font-size:12px;color:#888}.b{color:#333}em{background:yellow;font-style:normal}</style></head>
<body><h2>搜索引擎</h2>
<form onsubmit="search();return false"><input id="q" placeholder="输入查询..." autofocus/><button>搜索</button></form>
<div id="stats" class="s"></div>
<div id="r"></div>
<script>
async function loadStats(){const s=await(await fetch('/stats')).json();document.getElementById('stats').textContent=JSON.stringify(s);}
async function search(){
  const q=document.getElementById('q').value;
  if(!q)return;
  const r=await(await fetch('/search?q='+encodeURIComponent(q))).json();
  document.getElementById('r').innerHTML='<p>共 '+r.total+' 个结果</p>'+r.results.map(x=>'<div class="r"><div class="t">'+x.doc.title+'</div><div class="s">分数: '+x.score.toFixed(3)+' | 命中: '+x.matched.join(', ')+'</div><div class="b">'+x.snippet+'</div></div>').join('');
}
loadStats();
</script></body></html>`);
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
});

server.listen(PORT, () => console.log(`搜索引擎: http://127.0.0.1:${PORT}`));
process.on('SIGINT', () => { server.close(); process.exit(0); });
