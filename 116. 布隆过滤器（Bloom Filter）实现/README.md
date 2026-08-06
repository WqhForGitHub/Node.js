# 116. 布隆过滤器（Bloom Filter）实现

位数组 + k 个哈希函数的 Bloom Filter，纯 Node.js 原生实现（`Buffer` 当位数组、`crypto` 生成多哈希）。

## 运行

```bash
npx ts-node bloom.ts
```

## 要点

- `add` 把 k 个哈希位置位 1；`mightContain` 检查 k 个位是否全为 1。
- **没有假阴性**：`mightContain=false` 时元素一定不存在；`true` 只代表可能存在。
- 单哈希派生多哈希避免引入第三方库，实验性简化实现。