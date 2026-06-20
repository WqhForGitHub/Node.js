# 121. Docker部署模板

Koa + TypeScript demo，提供 Docker 化部署所需文件（Dockerfile / docker-compose.yml / .dockerignore）

## 运行

### 本地运行

```bash
npm install
npm run dev
```

### Docker 运行

```bash
# 构建并启动容器
docker compose up

# 后台运行
docker compose up -d

# 查看日志
docker compose logs -f

# 停止并删除容器
docker compose down
```

容器启动后访问 http://localhost:3000/health 进行健康检查。

> 纯 Koa + TypeScript demo。
