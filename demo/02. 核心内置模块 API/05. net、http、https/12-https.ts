/**
 * Demo 12 - https 模块（http over TLS：自签名证书 / 证书校验）
 * 运行：node "demo/02. 核心内置模块 API/05. net、http、https/12-https.ts"（Node 22.18+，需 openssl）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const https = require('node:https') as typeof import('node:https');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFileSync } = require('node:child_process') as typeof import('node:child_process');

const TMP = path.join(__dirname, 'tmp');

// openssl 生成私钥 + 自签名证书（仅本地演示；生产环境应向 CA 申请）
function genCert(): { key: Buffer; cert: Buffer } | null {
  const keyFile = path.join(TMP, 'key.pem');
  const certFile = path.join(TMP, 'cert.pem');
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
        '-keyout',
        keyFile,
        '-out',
        certFile,
      ],
      { stdio: 'ignore' }
    );
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  } catch {
    return null; // 未安装 openssl
  }
}

async function main(): Promise<void> {
  const pair = genCert();
  if (!pair) {
    console.log('未找到 openssl，无法生成自签名证书，跳过演示');
    return;
  }
  const { key, cert } = pair;

  // 1. HTTPS 服务器：比 http 多传 { key, cert }，req/res 用法相同
  const server = https.createServer({ key, cert }, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Hello HTTPS');
  });

  // 2. 不指定 host：监听所有网卡
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };

  // 3. 默认严格校验：自签名证书不在信任列表，直接报错
  await new Promise<void>((resolve) => {
    https
      .get(`https://localhost:${port}/`, (res) => {
        res.resume();
        res.on('end', () => resolve());
      })
      .on('error', (err) => {
        console.log('3. 校验失败:', (err as NodeJS.ErrnoException).code);
        resolve();
      });
  });

  // 4. 调试方案：rejectUnauthorized: false 跳过校验（有中间人风险）
  await new Promise<void>((resolve) => {
    https.get(`https://localhost:${port}/`, { rejectUnauthorized: false }, (res) => {
      const tlsSocket = res.socket as import('node:tls').TLSSocket; // socket 是 TLSSocket
      console.log('4. 协议:', tlsSocket.getProtocol(), '| 状态码:', res.statusCode);
      res.on('data', (chunk) => console.log('4. 响应体:', chunk.toString()));
      res.on('end', resolve);
    });
  });

  // 5. 正确方案：ca 把证书加入信任列表，不关校验
  await new Promise<void>((resolve) => {
    https.get(`https://localhost:${port}/`, { agent: new https.Agent({ ca: cert }) }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('5. 响应体:', data);
        resolve();
      });
    });
  });

  // 6. 关闭服务器（https.request 与 http 完全一致，不再演示）
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('6. 服务器已关闭');
}

// 入口：建目录 → 演示 → 清理
(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  try {
    await main();
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.log('临时目录已清理');
  }
})();
