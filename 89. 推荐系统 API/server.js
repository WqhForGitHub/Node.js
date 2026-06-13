// 推荐系统 API - 纯 Node.js 实现
// 支持: 基于协同过滤(用户/物品)、基于内容、热门推荐、混合推荐
const http = require('http');
const url = require('url');

// ========= 数据层 =========
// 用户-物品评分(1-5)
const ratings = {
  u1: { i1: 5, i2: 3, i3: 4, i5: 2 },
  u2: { i1: 4, i2: 5, i4: 3, i6: 4 },
  u3: { i2: 2, i3: 5, i4: 4, i5: 3 },
  u4: { i1: 3, i3: 2, i5: 5, i6: 4 },
  u5: { i2: 4, i4: 5, i6: 3 }
};

// 物品元数据(基于内容推荐)
const items = {
  i1: { name: '机器学习实战', tags: ['AI', '机器学习', '编程'] },
  i2: { name: '深入Node.js', tags: ['编程', 'Node.js', '后端'] },
  i3: { name: '深度学习入门', tags: ['AI', '深度学习'] },
  i4: { name: 'Vue.js 实战', tags: ['前端', 'JavaScript', 'Vue'] },
  i5: { name: 'Python 编程', tags: ['编程', 'Python'] },
  i6: { name: 'React 高级', tags: ['前端', 'JavaScript', 'React'] }
};

// 行为日志(用于热门统计)
const events = []; // {userId, itemId, type, ts}

// ========= 算法 =========
// 余弦相似度
function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] || 0, y = b[k] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 基于用户的协同过滤
function userCF(userId, topN = 3) {
  const me = ratings[userId];
  if (!me) return [];
  const sims = [];
  for (const uid in ratings) {
    if (uid === userId) continue;
    sims.push({ uid, sim: cosineSim(me, ratings[uid]) });
  }
  sims.sort((a, b) => b.sim - a.sim);
  const scores = {};
  for (const { uid, sim } of sims.slice(0, 3)) {
    if (sim <= 0) continue;
    for (const iid in ratings[uid]) {
      if (me[iid]) continue; // 已评分过滤
      scores[iid] = (scores[iid] || 0) + sim * ratings[uid][iid];
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([iid, score]) => ({ itemId: iid, name: items[iid]?.name, score: +score.toFixed(3) }));
}

// 基于物品的协同过滤
function itemCF(userId, topN = 3) {
  const me = ratings[userId];
  if (!me) return [];
  // 构建物品评分向量
  const itemVec = {};
  for (const uid in ratings) {
    for (const iid in ratings[uid]) {
      itemVec[iid] = itemVec[iid] || {};
      itemVec[iid][uid] = ratings[uid][iid];
    }
  }
  const scores = {};
  for (const liked in me) {
    for (const iid in itemVec) {
      if (iid === liked || me[iid]) continue;
      const sim = cosineSim(itemVec[liked], itemVec[iid]);
      if (sim <= 0) continue;
      scores[iid] = (scores[iid] || 0) + sim * me[liked];
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([iid, score]) => ({ itemId: iid, name: items[iid]?.name, score: +score.toFixed(3) }));
}

// 基于内容的推荐
function contentBased(userId, topN = 3) {
  const me = ratings[userId];
  if (!me) return [];
  // 用户标签偏好
  const tagPref = {};
  for (const iid in me) {
    for (const tag of (items[iid]?.tags || [])) {
      tagPref[tag] = (tagPref[tag] || 0) + me[iid];
    }
  }
  const scores = {};
  for (const iid in items) {
    if (me[iid]) continue;
    let s = 0;
    for (const tag of items[iid].tags) s += (tagPref[tag] || 0);
    scores[iid] = s;
  }
  return Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([iid, score]) => ({ itemId: iid, name: items[iid]?.name, score }));
}

// 热门推荐
function popular(topN = 3) {
  const counts = {};
  for (const uid in ratings) {
    for (const iid in ratings[uid]) {
      counts[iid] = (counts[iid] || 0) + ratings[uid][iid];
    }
  }
  for (const e of events) {
    counts[e.itemId] = (counts[e.itemId] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([iid, score]) => ({ itemId: iid, name: items[iid]?.name, score }));
}

// 混合推荐(加权)
function hybrid(userId, topN = 5) {
  const merged = {};
  const add = (list, weight) => {
    for (const r of list) {
      merged[r.itemId] = (merged[r.itemId] || 0) + r.score * weight;
    }
  };
  add(userCF(userId, 10), 0.4);
  add(itemCF(userId, 10), 0.4);
  add(contentBased(userId, 10), 0.2);
  return Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([iid, score]) => ({ itemId: iid, name: items[iid]?.name, score: +score.toFixed(3) }));
}

// ========= HTTP 服务 =========
function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  const userId = query.userId || 'u1';
  const topN = parseInt(query.topN) || 3;

  try {
    if (pathname === '/recommend/user-cf') return send(res, 200, { algo: 'UserCF', userId, items: userCF(userId, topN) });
    if (pathname === '/recommend/item-cf') return send(res, 200, { algo: 'ItemCF', userId, items: itemCF(userId, topN) });
    if (pathname === '/recommend/content') return send(res, 200, { algo: 'ContentBased', userId, items: contentBased(userId, topN) });
    if (pathname === '/recommend/popular') return send(res, 200, { algo: 'Popular', items: popular(topN) });
    if (pathname === '/recommend/hybrid') return send(res, 200, { algo: 'Hybrid', userId, items: hybrid(userId, topN) });

    if (pathname === '/rate' && req.method === 'POST') {
      const body = await readBody(req);
      const { uid, iid, score } = body;
      if (!uid || !iid || !score) return send(res, 400, { error: '缺少参数' });
      ratings[uid] = ratings[uid] || {};
      ratings[uid][iid] = score;
      return send(res, 200, { ok: true, ratings: ratings[uid] });
    }

    if (pathname === '/event' && req.method === 'POST') {
      const body = await readBody(req);
      events.push({ ...body, ts: Date.now() });
      return send(res, 200, { ok: true, total: events.length });
    }

    if (pathname === '/items') return send(res, 200, items);
    if (pathname === '/users') return send(res, 200, Object.keys(ratings));

    if (pathname === '/') {
      return send(res, 200, {
        name: '推荐系统 API',
        endpoints: [
          'GET  /recommend/user-cf?userId=u1&topN=3',
          'GET  /recommend/item-cf?userId=u1',
          'GET  /recommend/content?userId=u1',
          'GET  /recommend/popular',
          'GET  /recommend/hybrid?userId=u1',
          'POST /rate  {uid,iid,score}',
          'POST /event {userId,itemId,type}',
          'GET  /items',
          'GET  /users'
        ]
      });
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

const PORT = 3089;
server.listen(PORT, () => {
  console.log(`[推荐系统] http://localhost:${PORT}`);
  console.log('试试: curl http://localhost:3089/recommend/hybrid?userId=u1');
});
