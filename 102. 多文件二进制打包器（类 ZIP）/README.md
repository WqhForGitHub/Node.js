# 102. 多文件二进制打包器（类 ZIP）

自定义一种极简二进制打包格式 `BPK`，包含魔数 + 索引 + 数据段，支持打包 / 列表 / 解包。

## 格式

```
[Header]   magic "BPK1" + uint32 文件数
[Index * N] uint16 nameLen + name + uint64 size + uint64 offset
[Data]     文件数据顺序排列
```

## 运行

```bash
npx ts-node pack.ts pack out.bpk a.txt b.txt
npx ts-node pack.ts list out.bpk
npx ts-node pack.ts unpack out.bpk ./unpacked
```

## 要点

- 索引在前、数据在后，解包时先解析索引再按 offset 随机读取。
- 写入数据段使用 `pipe(out, { end: false })` 串接流避免内存堆积。