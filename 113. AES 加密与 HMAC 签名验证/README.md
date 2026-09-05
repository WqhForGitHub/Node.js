# 113. AES 加密与 HMAC 签名验证

- AES-256-GCM 对称加密：输出 `iv + ciphertext + authTag`，解密时 `setAuthTag` 校验完整性。
- HMAC-SHA256：对一段 payload 生成签名，并用 `crypto.timingSafeEqual` **恒定时间**比对防御**定时攻击**。

## 运行

```bash
npx ts-node crypto.ts
```

## 要点

- 密钥长度严格 32 字节，IV 每次随机 12 字节。
- **GCM 模式自带认证**，密文被篡改解密会抛错；外加 HMAC 用于业务报文防篡改。
- 比较签名使用 `timingSafeEqual`，避免因比较耗时差异泄露**前缀**。