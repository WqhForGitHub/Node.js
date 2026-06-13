# AI 推理 API 服务（调用模型）

纯 Node.js 实现的 AI 推理 API 网关，兼容 OpenAI Chat Completions 协议，可对接多种上游模型。

## 功能特性

- **OpenAI 兼容 API**: `/v1/chat/completions` 接口与 OpenAI SDK 兼容
- **多 Provider 后端**: 内置 Mock + OpenAI/Ollama 兼容 Provider
- **流式响应（SSE）**: 边生成边返回，提升用户体验
- **API Key 鉴权**: 多用户隔离
- **配额限制**: 每日 token 上限 + RPM 限流
- **用量统计**: 实时跟踪 token 消耗、调用次数
- **模型路由**: 按 model 名分发到不同后端
- **使用日志**: 持久化到 `usage.log`
- **Web Playground**: 浏览器内测试模型

## 文件

- [server.js](./server.js) - API 服务端
- [client.js](./client.js) - 客户端 SDK 与演示

## 快速启动

```bash
# 1. 启动服务
node server.js
# 访问 http://localhost:3099

# 2. 运行演示客户端
node client.js
```

## 接入真实模型

通过环境变量配置上游 API：

```bash
# 接入 OpenAI
set OPENAI_API_KEY=sk-xxxx
node server.js

# 接入本地 Ollama
set OLLAMA_BASE_URL=http://localhost:11434
node server.js
```

## API 示例

### 列出模型

```bash
curl http://localhost:3099/v1/models
```

### 聊天补全

```bash
curl -X POST http://localhost:3099/v1/chat/completions \
  -H "Authorization: Bearer sk-demo-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mock-gpt",
    "messages": [{"role":"user","content":"你好"}]
  }'
```

### 流式响应

```bash
curl -X POST http://localhost:3099/v1/chat/completions \
  -H "Authorization: Bearer sk-demo-12345" \
  -H "Content-Type: application/json" \
  -d '{"model":"mock-gpt","messages":[{"role":"user","content":"讲个笑话"}],"stream":true}'
```

### 用量查询

```bash
curl http://localhost:3099/v1/usage \
  -H "Authorization: Bearer sk-demo-12345"
```

## 演示 API Key

`sk-demo-12345` （日限 100000 tokens, RPM 60）

## 架构

```
Client ──[OpenAI 协议]──> 推理网关
                            ├── ApiKeyManager (鉴权/配额/限流)
                            ├── ModelRouter (路由)
                            └── Provider (实际调用上游)
                                ├── MockProvider
                                ├── OpenAICompatibleProvider
                                └── OllamaProvider
```

由于网关本身使用 OpenAI 兼容协议，任何支持 OpenAI 协议的客户端 SDK（如 `openai` 包）都可以将 `base_url` 指向本网关使用。
