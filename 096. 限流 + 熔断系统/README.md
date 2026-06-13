# 96. 限流 + 熔断系统

纯 Node.js 实现的四种限流算法 + 三态熔断器。

## 限流算法
| Code | 算法 | 配置 |
|---|---|---|
| tb | 令牌桶 Token Bucket | 容量 5,2 token/s |
| lb | 漏桶 Leaky Bucket | 容量 5,2 leak/s |
| fw | 固定窗口 Fixed Window | 1s 内 5 次 |
| sw | 滑动窗口 Sliding Window | 1s 内 5 次 |

## 熔断器
状态机: `CLOSED -> OPEN -> HALF_OPEN -> CLOSED/OPEN`
- `failureThreshold`: 连续失败 3 次后 OPEN
- `halfOpenAfterMs`: 5 秒后变 HALF_OPEN 放探针
- HALF_OPEN 探针成功足够 -> CLOSED, 失败 -> OPEN

## 启动
```bash
node server.js   # http://localhost:3096
```

## 接口
| 路径 | 说明 |
|---|---|
| `/limit/tb` | 令牌桶限流测试 |
| `/limit/lb` | 漏桶 |
| `/limit/fw` | 固定窗口 |
| `/limit/sw` | 滑动窗口 |
| `/protected` | 按 IP 限流 (3 req/s) |
| `/breaker/call` | 经过熔断器调用上游 |
| `/breaker/mode?mode=fail\|normal` | 切换上游模拟状态 |
| `/breaker/reset` | 重置熔断器 |
| `/status` | 全局状态 |

## 限流测试
```bash
# 快速发请求观察 429
for i in 1 2 3 4 5 6 7 8; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3096/limit/tb
done
```

## 熔断测试
```bash
# 1. 让上游开始失败
curl "http://localhost:3096/breaker/mode?mode=fail"

# 2. 连续 3 次失败后熔断器 OPEN
for i in 1 2 3 4; do curl http://localhost:3096/breaker/call; done

# 3. 5 秒后变 HALF_OPEN, 此时把上游恢复
curl "http://localhost:3096/breaker/mode?mode=normal"
sleep 5
curl http://localhost:3096/breaker/call    # 探针成功 -> CLOSED
```
