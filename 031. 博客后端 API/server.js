const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = 3000;

// ==================== 数据存储 ====================

const posts = [
  {
    id: '1',
    title: 'Node.js 入门指南',
    content:
      'Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时，让你能够在服务器端运行 JavaScript。',
    summary: '快速了解 Node.js 基础知识',
    category: '1',
    tags: ['Node.js', 'JavaScript', '后端'],
    author: 'admin',
    status: 'published',
    viewCount: 128,
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-15T08:00:00.000Z',
  },
  {
    id: '2',
    title: 'RESTful API 设计最佳实践',
    content:
      'RESTful API 是一种基于 HTTP 协议的架构风格，遵循 REST 原则设计 Web 接口。本文介绍如何设计清晰、一致的 API。',
    summary: '学习 RESTful API 的设计原则与规范',
    category: '2',
    tags: ['API', 'REST', '架构'],
    author: 'admin',
    status: 'published',
    viewCount: 256,
    createdAt: '2025-02-10T10:30:00.000Z',
    updatedAt: '2025-02-12T09:00:00.000Z',
  },
  {
    id: '3',
    title: '用纯 Node.js 构建 Web 服务器',
    content: '不依赖任何框架，仅使用 Node.js 内置的 http 模块，从零构建一个功能完整的 Web 服务器。',
    summary: '深入理解 Node.js http 模块',
    category: '1',
    tags: ['Node.js', 'HTTP', '后端'],
    author: 'editor',
    status: 'draft',
    viewCount: 0,
    createdAt: '2025-03-05T14:00:00.000Z',
    updatedAt: '2025-03-05T14:00:00.000Z',
  },
];

const categories = [
  {
    id: '1',
    name: '技术教程',
    description: '编程技术学习教程',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: '架构设计',
    description: '软件架构与设计模式',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '3',
    name: '项目实战',
    description: '实际项目开发经验分享',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

let comments = [
  {
    id: '1',
    postId: '1',
    author: '读者A',
    content: '写得很清晰，对我入门很有帮助！',
    createdAt: '2025-01-16T10:00:00.000Z',
  },
  {
    id: '2',
    postId: '1',
    author: '读者B',
    content: '期待更多 Node.js 相关的内容。',
    createdAt: '2025-01-17T15:30:00.000Z',
  },
  {
    id: '3',
    postId: '2',
    author: '开发者C',
    content: 'REST 规范总结得很到位，收藏了。',
    createdAt: '2025-02-11T08:00:00.000Z',
  },
];

// 简易 Token 存储（演示用）
const tokens = { admin_token: 'admin', editor_token: 'editor' };

// ==================== 工具函数 ====================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function generateId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

// 解析路径参数：匹配 /posts/:id 等模式
function matchRoute(pathname, pattern) {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// 简易认证中间件
function authenticate(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return tokens[token] || null;
}

// ==================== 文章接口 ====================

// GET /posts - 文章列表（分页、搜索、分类筛选、标签筛选、状态筛选）
function getPosts(req, res, query) {
  const { page = '1', pageSize = '10', search, category, tag, status, author } = query;

  let result = [...posts];

  // 按状态筛选
  if (status) {
    result = result.filter((p) => p.status === status);
  }

  // 按分类筛选
  if (category) {
    result = result.filter((p) => p.category === category);
  }

  // 按标签筛选
  if (tag) {
    result = result.filter((p) => p.tags.includes(tag));
  }

  // 按作者筛选
  if (author) {
    result = result.filter((p) => p.author === author);
  }

  // 关键词搜索（标题 + 内容 + 摘要）
  if (search) {
    const keyword = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        p.content.toLowerCase().includes(keyword) ||
        p.summary.toLowerCase().includes(keyword)
    );
  }

  // 按创建时间倒序
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 分页
  const pageNum = Math.max(1, parseInt(page));
  const size = Math.max(1, Math.min(100, parseInt(pageSize)));
  const total = result.length;
  const totalPages = Math.ceil(total / size);
  const start = (pageNum - 1) * size;
  const data = result.slice(start, start + size);

  // 为每篇文章附加分类名称和评论数
  const enriched = data.map((post) => ({
    ...post,
    categoryName: categories.find((c) => c.id === post.category)?.name || null,
    commentCount: comments.filter((c) => c.postId === post.id).length,
  }));

  send(res, 200, {
    success: true,
    pagination: { page: pageNum, pageSize: size, total, totalPages },
    data: enriched,
  });
}

// GET /posts/:id - 文章详情
function getPostById(req, res, id) {
  const post = posts.find((p) => p.id === id);
  if (!post) {
    return send(res, 404, { success: false, error: '文章不存在' });
  }

  // 增加浏览量
  post.viewCount += 1;

  // 附加分类名称和评论列表
  const postComments = comments.filter((c) => c.postId === id);
  const categoryName = categories.find((c) => c.id === post.category)?.name || null;

  send(res, 200, {
    success: true,
    data: { ...post, categoryName, comments: postComments },
  });
}

// POST /posts - 创建文章
async function createPost(req, res, username) {
  const body = await parseBody(req);
  const { title, content, summary, category, tags, status } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return send(res, 400, { success: false, error: '标题为必填项' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return send(res, 400, { success: false, error: '内容为必填项' });
  }

  // 校验分类是否存在
  if (category && !categories.find((c) => c.id === category)) {
    return send(res, 400, { success: false, error: '分类不存在' });
  }

  const timestamp = now();
  const post = {
    id: generateId(),
    title: title.trim(),
    content: content.trim(),
    summary: summary ? summary.trim() : title.trim().slice(0, 50),
    category: category || null,
    tags: Array.isArray(tags) ? tags : [],
    author: username,
    status: status === 'published' ? 'published' : 'draft',
    viewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  posts.push(post);
  send(res, 201, { success: true, data: post });
}

// PUT /posts/:id - 更新文章
async function updatePost(req, res, id, username) {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: '文章不存在' });
  }

  const body = await parseBody(req);
  const { title, content, summary, category, tags, status } = body;

  if (category && !categories.find((c) => c.id === category)) {
    return send(res, 400, { success: false, error: '分类不存在' });
  }
  if (status && !['published', 'draft'].includes(status)) {
    return send(res, 400, {
      success: false,
      error: '状态只支持 published 或 draft',
    });
  }

  const post = { ...posts[index] };
  if (title !== undefined) post.title = title.trim();
  if (content !== undefined) post.content = content.trim();
  if (summary !== undefined) post.summary = summary.trim();
  if (category !== undefined) post.category = category;
  if (tags !== undefined) post.tags = Array.isArray(tags) ? tags : post.tags;
  if (status !== undefined) post.status = status;
  post.updatedAt = now();

  posts[index] = post;
  send(res, 200, { success: true, data: post });
}

// DELETE /posts/:id - 删除文章
function deletePost(req, res, id) {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: '文章不存在' });
  }

  const deleted = posts.splice(index, 1)[0];
  // 同时删除该文章的所有评论
  comments = comments.filter((c) => c.postId !== id);

  send(res, 200, { success: true, data: deleted });
}

// ==================== 分类接口 ====================

// GET /categories - 分类列表
function getCategories(req, res) {
  const result = categories.map((cat) => ({
    ...cat,
    postCount: posts.filter((p) => p.category === cat.id).length,
  }));
  send(res, 200, { success: true, data: result });
}

// POST /categories - 创建分类
async function createCategory(req, res) {
  const body = await parseBody(req);
  const { name, description } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return send(res, 400, { success: false, error: '分类名称为必填项' });
  }

  if (categories.find((c) => c.name === name.trim())) {
    return send(res, 409, { success: false, error: '分类名称已存在' });
  }

  const category = {
    id: generateId(),
    name: name.trim(),
    description: description ? description.trim() : '',
    createdAt: now(),
  };

  categories.push(category);
  send(res, 201, { success: true, data: category });
}

// PUT /categories/:id - 更新分类
async function updateCategory(req, res, id) {
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: '分类不存在' });
  }

  const body = await parseBody(req);
  const { name, description } = body;

  if (name && categories.find((c) => c.name === name.trim() && c.id !== id)) {
    return send(res, 409, { success: false, error: '分类名称已存在' });
  }

  const category = { ...categories[index] };
  if (name !== undefined) category.name = name.trim();
  if (description !== undefined) category.description = description.trim();

  categories[index] = category;
  send(res, 200, { success: true, data: category });
}

// DELETE /categories/:id - 删除分类
function deleteCategory(req, res, id) {
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: '分类不存在' });
  }

  // 检查是否有文章使用此分类
  const usedByPosts = posts.filter((p) => p.category === id);
  if (usedByPosts.length > 0) {
    return send(res, 409, {
      success: false,
      error: `该分类下还有 ${usedByPosts.length} 篇文章，无法删除`,
    });
  }

  const deleted = categories.splice(index, 1)[0];
  send(res, 200, { success: true, data: deleted });
}

// ==================== 评论接口 ====================

// GET /posts/:id/comments - 获取文章评论
function getComments(req, res, postId) {
  const post = posts.find((p) => p.id === postId);
  if (!post) {
    return send(res, 404, { success: false, error: '文章不存在' });
  }

  const postComments = comments.filter((c) => c.postId === postId);
  send(res, 200, {
    success: true,
    count: postComments.length,
    data: postComments,
  });
}

// POST /posts/:id/comments - 创建评论
async function createComment(req, res, postId) {
  const post = posts.find((p) => p.id === postId);
  if (!post) {
    return send(res, 404, { success: false, error: '文章不存在' });
  }
  if (post.status !== 'published') {
    return send(res, 400, { success: false, error: '无法对未发布的文章评论' });
  }

  const body = await parseBody(req);
  const { author, content } = body;

  if (!author || typeof author !== 'string' || !author.trim()) {
    return send(res, 400, { success: false, error: '评论者昵称为必填项' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return send(res, 400, { success: false, error: '评论内容为必填项' });
  }

  const comment = {
    id: generateId(),
    postId,
    author: author.trim(),
    content: content.trim(),
    createdAt: now(),
  };

  comments.push(comment);
  send(res, 201, { success: true, data: comment });
}

// DELETE /comments/:id - 删除评论
function deleteComment(req, res, id) {
  const index = comments.findIndex((c) => c.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: '评论不存在' });
  }

  const deleted = comments.splice(index, 1)[0];
  send(res, 200, { success: true, data: deleted });
}

// ==================== 标签接口 ====================

// GET /tags - 获取所有标签
function getTags(req, res) {
  const tagSet = new Set();
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));

  const tags = [...tagSet].map((name) => ({
    name,
    postCount: posts.filter((p) => p.tags.includes(name)).length,
  }));

  tags.sort((a, b) => b.postCount - a.postCount);
  send(res, 200, { success: true, data: tags });
}

// ==================== 统计接口 ====================

// GET /stats - 博客统计
function getStats(req, res) {
  const publishedPosts = posts.filter((p) => p.status === 'published');
  const totalViews = publishedPosts.reduce((sum, p) => sum + p.viewCount, 0);

  send(res, 200, {
    success: true,
    data: {
      totalPosts: posts.length,
      publishedPosts: publishedPosts.length,
      draftPosts: posts.length - publishedPosts.length,
      totalComments: comments.length,
      totalCategories: categories.length,
      totalViews,
    },
  });
}

// ==================== 路由分发 ====================

async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const query = parsedUrl.query;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ---------- 文章路由 ----------

    // GET /posts
    if (method === 'GET' && pathname === '/posts') {
      return getPosts(req, res, query);
    }

    // POST /posts
    if (method === 'POST' && pathname === '/posts') {
      const user = authenticate(req);
      if (!user)
        return send(res, 401, {
          success: false,
          error: '未授权，请提供有效 Token',
        });
      return await createPost(req, res, user);
    }

    // GET /posts/:id/comments
    let params = matchRoute(pathname, '/posts/:id/comments');
    if (params) {
      if (method === 'GET') return getComments(req, res, params.id);
      if (method === 'POST') return await createComment(req, res, params.id);
    }

    // GET /posts/:id
    params = matchRoute(pathname, '/posts/:id');
    if (params && !pathname.includes('/comments')) {
      if (method === 'GET') return getPostById(req, res, params.id);
      if (method === 'PUT') {
        const user = authenticate(req);
        if (!user)
          return send(res, 401, {
            success: false,
            error: '未授权，请提供有效 Token',
          });
        return await updatePost(req, res, params.id, user);
      }
      if (method === 'DELETE') {
        const user = authenticate(req);
        if (!user)
          return send(res, 401, {
            success: false,
            error: '未授权，请提供有效 Token',
          });
        return deletePost(req, res, params.id);
      }
    }

    // ---------- 分类路由 ----------

    // GET /categories
    if (method === 'GET' && pathname === '/categories') {
      return getCategories(req, res);
    }

    // POST /categories
    if (method === 'POST' && pathname === '/categories') {
      const user = authenticate(req);
      if (!user)
        return send(res, 401, {
          success: false,
          error: '未授权，请提供有效 Token',
        });
      return await createCategory(req, res);
    }

    // PUT /categories/:id
    params = matchRoute(pathname, '/categories/:id');
    if (params) {
      if (method === 'PUT') {
        const user = authenticate(req);
        if (!user)
          return send(res, 401, {
            success: false,
            error: '未授权，请提供有效 Token',
          });
        return await updateCategory(req, res, params.id);
      }
      if (method === 'DELETE') {
        const user = authenticate(req);
        if (!user)
          return send(res, 401, {
            success: false,
            error: '未授权，请提供有效 Token',
          });
        return deleteCategory(req, res, params.id);
      }
    }

    // ---------- 评论路由 ----------

    // DELETE /comments/:id
    params = matchRoute(pathname, '/comments/:id');
    if (params && method === 'DELETE') {
      const user = authenticate(req);
      if (!user)
        return send(res, 401, {
          success: false,
          error: '未授权，请提供有效 Token',
        });
      return deleteComment(req, res, params.id);
    }

    // ---------- 标签路由 ----------

    // GET /tags
    if (method === 'GET' && pathname === '/tags') {
      return getTags(req, res);
    }

    // ---------- 统计路由 ----------

    // GET /stats
    if (method === 'GET' && pathname === '/stats') {
      return getStats(req, res);
    }

    // 404
    send(res, 404, { success: false, error: '接口不存在' });
  } catch (err) {
    if (err.message === 'Invalid JSON') {
      send(res, 400, { success: false, error: '请求体 JSON 格式无效' });
    } else {
      console.error('服务器错误:', err);
      send(res, 500, { success: false, error: '服务器内部错误' });
    }
  }
}

// ==================== 启动服务器 ====================

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`\n  博客后端 API 服务器已启动: http://localhost:${PORT}\n`);
  console.log(`  文章接口:`);
  console.log(
    `    GET    /posts                    - 文章列表（?page=&pageSize=&search=&category=&tag=&status=&author=）`
  );
  console.log(`    GET    /posts/:id                - 文章详情`);
  console.log(`    POST   /posts                    - 创建文章 [需认证]`);
  console.log(`    PUT    /posts/:id                - 更新文章 [需认证]`);
  console.log(`    DELETE /posts/:id                - 删除文章 [需认证]`);
  console.log(`\n  分类接口:`);
  console.log(`    GET    /categories               - 分类列表`);
  console.log(`    POST   /categories               - 创建分类 [需认证]`);
  console.log(`    PUT    /categories/:id           - 更新分类 [需认证]`);
  console.log(`    DELETE /categories/:id           - 删除分类 [需认证]`);
  console.log(`\n  评论接口:`);
  console.log(`    GET    /posts/:id/comments       - 获取文章评论`);
  console.log(`    POST   /posts/:id/comments       - 发表评论`);
  console.log(`    DELETE /comments/:id             - 删除评论 [需认证]`);
  console.log(`\n  标签接口:`);
  console.log(`    GET    /tags                     - 获取所有标签`);
  console.log(`\n  统计接口:`);
  console.log(`    GET    /stats                    - 博客统计数据`);
  console.log(`\n  认证方式: 请求头 Authorization: Bearer <token>`);
  console.log(`  可用 Token: admin_token, editor_token\n`);
});
