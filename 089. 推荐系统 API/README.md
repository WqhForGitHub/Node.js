# 89. 推荐系统 API

纯 Node.js 实现的推荐引擎,无任何第三方依赖。

## 算法
- **UserCF** 基于用户协同过滤(余弦相似度)
- **ItemCF** 基于物品协同过滤
- **ContentBased** 基于物品标签的内容推荐
- **Popular** 基于评分+行为的热门推荐
- **Hybrid** 三种算法加权融合(0.4/0.4/0.2)

## 启动
```bash
node server.js
# http://localhost:3089
```

## 接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /recommend/user-cf?userId=u1&topN=3 | 用户协同过滤 |
| GET | /recommend/item-cf?userId=u1 | 物品协同过滤 |
| GET | /recommend/content?userId=u1 | 内容推荐 |
| GET | /recommend/popular | 热门推荐 |
| GET | /recommend/hybrid?userId=u1 | 混合推荐 |
| POST | /rate `{uid,iid,score}` | 提交评分 |
| POST | /event `{userId,itemId,type}` | 上报行为 |

## 示例
```bash
curl "http://localhost:3089/recommend/hybrid?userId=u1&topN=5"
```
