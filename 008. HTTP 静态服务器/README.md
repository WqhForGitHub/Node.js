# HTTP 静态服务器

纯 Node.js 实现的 HTTP 静态文件服务器，零外部依赖。

## 功能特性

- **MIME 类型自动识别** - 支持 30+ 种文件类型的 Content-Type 自动设置
- **目录列表生成** - 美观的目录浏览页面，含文件大小和修改时间
- **默认首页** - 自动查找 index.html / index.htm
- **流式传输** - 大文件使用 Stream 管道传输，节省内存
- **缓存控制** - 支持 Cache-Control 和 Last-Modified 响应头
- **安全防护** - 防止路径遍历攻击（如 `../../etc/passwd`）
- **HEAD 请求** - 支持 HEAD 方法，仅返回响应头
- **命令行配置** - 灵活的端口、目录、缓存等参数
- **优雅关闭** - 支持 SIGINT/SIGTERM 信号优雅关闭

## 快速开始

```bash
# 启动服务器（默认端口 3000）
node server.js

# 或使用 npm
npm start
```

访问 http://127.0.0.1:3000 即可查看效果。

## 命令行参数

| 参数 | 缩写 | 默认值 | 说明 |
|------|------|--------|------|
| `--port` | `-p` | 3000 | 监听端口 |
| `--host` | `-h` | 127.0.0.1 | 监听地址 |
| `--root` | `-r` | ./public | 静态文件根目录 |
| `--no-cache` | - | - | 禁用缓存 |
| `--no-listing` | - | - | 禁用目录列表 |
| `--help` | - | - | 显示帮助信息 |

## 示例

```bash
# 自定义端口
node server.js --port 8080

# 对外开放访问
node server.js --host 0.0.0.0 --port 80

# 指定其他目录
node server.js --root ./dist

# 开发模式（无缓存）
node server.js --no-cache

# 生产环境
npm run prod
```

## 项目结构

```
08. HTTP 静态服务器/
├── server.js           # 服务器主文件
├── package.json        # 项目配置
├── README.md           # 说明文档
└── public/             # 静态文件目录（默认根目录）
    ├── index.html      # 默认首页
    ├── data.json       # 测试用 JSON
    ├── css/
    │   └── style.css   # 样式文件
    ├── js/
    │   └── app.js      # 脚本文件
    └── images/         # 图片目录
```

## 实现原理

1. 使用 `http.createServer()` 创建 HTTP 服务器
2. 使用 `fs.stat()` 检查文件/目录是否存在
3. 使用 `fs.createReadStream()` 流式读取文件并通过 `.pipe()` 传输
4. 使用 `path.normalize()` + 路径前缀检查防止路径遍历
5. 通过文件扩展名查找 MIME 类型映射表设置 Content-Type
6. 目录请求时自动生成 HTML 目录列表页面
