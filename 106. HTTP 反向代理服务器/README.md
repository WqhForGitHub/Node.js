# 106. HTTP 反向代理服务器

按路径前缀把请求转发到后端，演示 `http.request` 把客户端请求头/体透传给上游，并把上游响应 `pipe` 回客户端。同时内置 round-robin 负载均衡。

## 运行

```bash
npx ts-node proxy.ts 8000
# 访问 http://localhost:8000/api/users -> https://jsonplaceholder.typicode.com/users
curl http://localhost:8000/api/users
```

## 要点

- 同时支持 `http` 与 `https` 上游，删除客户端 `host` 头改写为上游域名。
- 多目标数组提供简单轮询负载均衡。
- 上游失败返回 502。