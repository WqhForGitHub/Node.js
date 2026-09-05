# 74. 实时数据流处理系统

仿照 Spark Streaming/Flink 的简化版实时流处理引擎，纯 Node.js 实现。

## 特性

- **算子**：map、filter、groupBy、forEach、to(sink)
- **窗口**：滚动窗口（window）、滑动窗口（slidingWindow）
- **聚合器**：count、sum、avg、topK
- **多入口**：HTTP（低速可靠）、UDP（高吞吐）

## 文件

- `stream.js` - 流处理核心引擎
- `server.js` - 接收端 + 处理管道
- `producer.js` - 模拟事件源（UDP）

## 运行

```bash
# 终端 1: 启动流处理服务
node server.js

# 终端 2: 启动生产者
node producer.js
```

## 处理管道示例

```
events (源)
  |- map (丰富时间戳)
  |- filter (有效事件)
       |- 5s 滚动窗口 → 计数
       |- 10s/2s 滑动窗口 → TopK 类型
       |- error 类型 → 报警 Sink
```
