/**
 * crypto — 加密与哈希
 * 记住一句话：哈希不可逆（摘要），加密可逆（还原）；
 * 存密码必须用「随机盐 + 慢哈希（scrypt/bcrypt）」，绝不能只存 md5
 */
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

const password = "admin123";

// ---------- 1. 普通哈希：同一输入永远同一输出 ----------
// 适合文件校验/去重，不能直接用来存密码（可被彩虹表反查）
console.log("md5    :", createHash("md5").update(password).digest("hex"));
console.log("sha256 :", createHash("sha256").update(password).digest("hex"));

// ---------- 2. HMAC：带密钥的哈希，验证消息没被篡改（接口签名常用） ----------
const secret = "my-secret-key";
const sign = createHmac("sha256", secret).update("转账 100 元").digest("hex");
console.log("hmac   :", sign);

// ---------- 3. 随机数 ----------
console.log("随机 16 字节:", randomBytes(16).toString("hex"));
console.log("随机 UUID   :", randomUUID());

// ---------- 4. scrypt：密码存储的正确姿势（随机盐 + 慢哈希） ----------
function hashPassword(pwd: string): string {
  const salt = randomBytes(16);            // 每次生成新盐
  const hash = scryptSync(pwd, salt, 32);  // 慢哈希，暴力破解成本高
  return `${salt.toString("hex")}.${hash.toString("hex")}`; // 盐和哈希一起存
}

function verifyPassword(pwd: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(".");
  const hash = scryptSync(pwd, Buffer.from(saltHex, "hex"), 32);
  // timingSafeEqual 防时序攻击，两边长度必须相等
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

const stored = hashPassword(password);
console.log("\n存储的密码串:", stored);
console.log("正确密码校验:", verifyPassword("admin123", stored)); // true
console.log("错误密码校验:", verifyPassword("admin456", stored)); // false

// ---------- 5. AES 对称加密：可逆，加解密用同一组 key/iv ----------
const key = randomBytes(32); // aes-256-cbc 需要 32 字节 key
const iv = randomBytes(16);  // 初始向量 16 字节

const cipher = createCipheriv("aes-256-cbc", key, iv);
let encrypted = cipher.update("机密数据：明天吃火锅", "utf8", "hex");
encrypted += cipher.final("hex");
console.log("\nAES 加密:", encrypted);

const decipher = createDecipheriv("aes-256-cbc", key, iv);
let decrypted = decipher.update(encrypted, "hex", "utf8");
decrypted += decipher.final("utf8");
console.log("AES 解密:", decrypted);
