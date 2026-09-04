/**
 * Demo 21 - crypto 模块（哈希 / HMAC / 随机数 / 对称加密 / 签名 / 密码存储）
 * 运行：node "demo/02. 核心内置模块 API/08. crypto、crypto-webcrypto、permission/21-crypto.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('node:crypto') as typeof import('node:crypto');

function main(): void {
  // 1. 哈希：固定长度指纹，不可逆
  const hash = crypto.createHash('sha256').update('hello crypto').digest('hex');
  console.log(`1. SHA-256 哈希 = ${hash}`);

  // 2. HMAC：带密钥的哈希，可防篡改
  const hmac = crypto.createHmac('sha256', 'secret-key').update('hello').digest('hex');
  console.log(`2. HMAC = ${hmac}`);

  // 3. 随机数
  console.log(
    `3. 随机字节 = ${crypto.randomBytes(8).toString('hex')}  UUID = ${crypto.randomUUID()}`
  );

  // 4. 对称加密 AES-256-GCM：同一密钥加解密
  const key = crypto.randomBytes(32); // 256 位密钥
  const iv = crypto.randomBytes(12); // 随机 IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update('机密数据', 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 认证标签
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  console.log(`4. 加密 = ${encrypted.toString('hex')}  解密 = "${decrypted.toString('utf8')}"`);

  // 5. 非对称签名 RSA：私钥签名、公钥验签
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sign = crypto.sign('sha256', Buffer.from('合同内容'), privateKey);
  const verified = crypto.verify('sha256', Buffer.from('合同内容'), publicKey, sign);
  console.log(`5. 签名前 8 字节 = ${sign.subarray(0, 8).toString('hex')}...  验签 = ${verified}`);

  // 6. 密码存储：scrypt 加盐 + timingSafeEqual 比对
  const salt = crypto.randomBytes(16);
  const stored = crypto.scryptSync('password123', salt, 32); // 注册时存储
  const input = crypto.scryptSync('password123', salt, 32); // 登录时重算
  console.log(`6. 密码比对结果 = ${crypto.timingSafeEqual(stored, input)}`);
}

main();
