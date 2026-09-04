/**
 * Demo 22 - crypto-webcrypto 模块（Web Crypto API：与浏览器同构，Promise 风格）
 * 运行：node "demo/02. 核心内置模块 API/08. crypto、crypto-webcrypto、permission/22-crypto-webcrypto.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { webcrypto } = require('node:crypto') as typeof import('node:crypto');
const { subtle } = webcrypto;

const data = new TextEncoder().encode('hello webcrypto'); // 输入输出均为 Uint8Array

async function main(): Promise<void> {
  // 1. digest 摘要：等价 createHash('sha256')
  const digest = await subtle.digest('SHA-256', data);
  console.log(`1. SHA-256 摘要 = ${Buffer.from(digest).toString('hex')}`);

  // 2. AES-GCM 对称加解密：密钥为 CryptoKey 对象
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  console.log(`2. 解密还原 = "${new TextDecoder().decode(decrypted)}"`);

  // 3. ECDSA 签名验签：私钥签名、公钥验签
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, data);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, signature, data);
  console.log(`3. 验签结果 = ${ok}`);

  // 4. exportKey / importKey：公钥导出 JWK 便于分发
  const jwk = await subtle.exportKey('jwk', kp.publicKey);
  const pub = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'verify',
  ]);
  const ok2 = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, signature, data);
  console.log(`4. JWK = { kty: ${jwk.kty}, crv: ${jwk.crv} }  导入后验签 = ${ok2}`);
}

main();
