# 115. LRU Cache 实现（Map + 链表）

经典 LinkedHashMap 思路的 LRU：用原生 `Map` 做键到节点定位（O(1)），双向链表维护访问顺序；最近使用在前、最久未使用在后，满容量时删除尾节点。

## 运行

```bash
npx ts-node lru.ts
```

## 要点

- 哨兵 head/tail 节点省去边界判断，`remove` / `addToHead` 均为 O(1)。
- `get` 命中先把节点移到表头。
- `put` 容量超限时删除尾前一个节点并从 Map 移除。