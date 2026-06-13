# 87. 内存数据库（简化版）

纯 Node.js 实现的内存数据库，支持表/索引/查询/AOF 持久化。

## 特性

- 多表 + 主键 + 二级索引（unique / index）
- 查询：`gt/gte/lt/lte/ne/in/like` 操作符
- 排序、分页
- AOF 持久化（追加写日志，启动回放）
- TCP 协议 + 交互式 CLI

## 文件

- `engine.js` - 数据库引擎（Database / Table）
- `aof.js` - AOF 持久化
- `server.js` - TCP 服务器
- `cli.js` - 交互式客户端

## 启动

```bash
node server.js
node cli.js
```

## CLI 示例

```
memdb> create users {pk:"id", fields:{email:{unique:true}, age:{index:true}}}
memdb> insert users {name:"alice", email:"a@x.com", age:30}
memdb> insert users {name:"bob", email:"b@x.com", age:25}
memdb> find users {age:{op:"gte", value:26}}
memdb> get users 1
memdb> update users 1 {age:31}
memdb> tables
```
