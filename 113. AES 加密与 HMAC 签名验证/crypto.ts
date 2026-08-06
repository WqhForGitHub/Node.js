/**
 * AES 加密与 HMAC 签名验证
 *
 * 演示：
 *   - AES-256-GCM 对称加密 / 解密（带认证标签）
 *   - HMAC-SHA256 生成与验证（防篡改）
 *
 * 运行：npx ts-node crypto.ts
 */
import * as crypto from 'crypto';

const KEY = crypto.randomBytes(32); // 仿真密钥（实际应从 KMS / 环境变量读取）
const HMAC_KEY = crypto.randomBytes(32);

interface EncryptedPayload {
  iv: string; // base64
  data: string; // base64 (含 GCM tag 末尾 16 字节)
  tag: string; // base64
}

function aesEncrypt(plain: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), data: enc.toString('base64'), tag: tag.toString('base64') };
}

function aesDecrypt(p: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(p.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(p.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(p.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

function hmacSign(payload: string): string {
  return crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('hex');
}

function hmacVerify(payload: string, signature: string): boolean {
  const expect = hmacSign(payload);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expect, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ===== 演示 =====
const message = 'hello world, this is secret';
console.log('明文:', message);

const enc = aesEncrypt(message);
console.log('AES 加密:', enc);
const dec = aesDecrypt(enc);
console.log('AES 解密:', dec, ' 用时一致:', dec === message);

// HMAC 演示：签名 / 验证 / 篡改检测
const payload = JSON.stringify({ user: 'alice', ts: Date.now() });
const sig = hmacSign(payload);
console.log('HMAC 签名:', sig);
console.log('正常验证:', hmacVerify(payload, sig));
const tampered = JSON.stringify({ user: 'mallory', ts: Date.now() });
console.log('篡改后验证:', hmacVerify(tampered, sig));