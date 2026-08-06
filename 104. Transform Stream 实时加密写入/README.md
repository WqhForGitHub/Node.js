# 104. Transform Stream 实时加密写入

用自定义 `Transform` 流实现 XOR 流式加密，配合 `pipeline` 串联 `读流 → 加密 → 写流`。

## 运行

```bash
npx ts-node encrypt.ts enc plain.txt cipher.bin mySecretKey
npx ts-node encrypt.ts dec cipher.bin plain.out mySecretKey
diff plain.txt plain.out   # 应无差异
```

## 要点

- `_transform` 每来一段 buffer 就立刻加密并 `push`，全程流式、内存占用恒定。
- 密钥流由 `key[offset % len]` 与一个线性同余扰动字节异或得到，演示性质。
- `pipeline` 保证任何一个阶段出错都会正确销毁所有流。