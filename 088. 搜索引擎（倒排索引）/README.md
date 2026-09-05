# 88. 搜索引擎（倒排索引）

纯 Node.js 实现的全文搜索引擎，支持中英文分词、倒排索引、BM25 评分。

## 特性

- 倒排索引：term → 文档列表，记录词频和位置
- 分词器：英文按词、中文按字、停用词过滤、简单词干提取
- BM25 评分：考虑文档长度归一化的相关性算法
- 摘要高亮、命中词显示
- 增量索引、删除文档

## 文件

- `tokenizer.js` - 分词器（中英文 + 停用词 + 词干）
- `index.js` - 倒排索引 + BM25
- `server.js` - HTTP 搜索 API + Web UI
- `demo.js` - 离线演示

## 启动

```bash
node server.js   # 启动 HTTP 服务
node demo.js     # 离线演示
```

打开 http://127.0.0.1:7800 体验搜索 UI。

## API

- `POST /index` - 索引文档（单个或数组）
- `GET /search?q=...&limit=10` - 搜索
- `DELETE /doc/:id` - 删除文档
- `GET /stats` - 索引统计

## 文档格式

```json
{ "id": 1, "title": "标题", "body": "正文..." }
```

## BM25 公式

```
score(D, Q) = Σ IDF(qi) × tf(qi,D) × (k1+1) / (tf(qi,D) + k1 × (1-b + b × |D|/avgdl))
```

参数 `k1=1.5`, `b=0.75`。
