/**
 * Demo 15 - tls 模块（TLS/SSL：给 TCP 加加密层，https 就是 http + tls）
 * 运行：node "demo/02. 核心内置模块 API/06. https2、dgram、tls、dns/15-tls.ts"（Node 22.18+，需 openssl）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tls = require('node:tls') as typeof import('node:tls');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFileSync } = require('node:child_process') as typeof import('node:child_process');

const TMP = path.join(__dirname, 'tmp');

// openssl 生成私钥 + 自签名证书（同 Demo 12）
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

  // 1. tls.createServer：握手完成后拿到 TLSSocket（加密双工流），用法同 net.Socket
  const server = tls.createServer({ key, cert }, (socket) => {
    console.log('1. 客户端已接入，协议:', socket.getProtocol());
    socket.setEncoding('utf8');
    socket.on('data', (data: string) => {
      console.log('1. 服务器收到:', data.trim());
      socket.write(`echo: ${data}`); // 走的是加密通道
    });
    socket.on('end', () => socket.end()); // 对端结束，我也结束
  });
  server.on('tlsClientError', () => undefined); // 第 2 步的握手失败会触发，忽略
  server.on('error', (err) => console.error('服务器错误:', err.message));

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };

  // 2. tls.connect：默认严格校验，自签名证书不在信任列表 → 握手失败
  await new Promise<void>((resolve) => {
    tls
      .connect({ port, host: '127.0.0.1' })
      .on('error', (err) => {
        console.log('2. 校验失败:', (err as NodeJS.ErrnoException).code);
        resolve();
      })
      .on('secureConnect', () => resolve()); // 正常应走不到这里
  });

  // 3. rejectUnauthorized: false：跳过校验（仅本地调试），握手后照常读写
  await new Promise<void>((resolve) => {
    const socket = tls.connect({ port, host: '127.0.0.1', rejectUnauthorized: false }, () => {
      // connect 回调 = secureConnect：加密通道已就绪
      console.log('3. 协议:', socket.getProtocol(), '| authorized:', socket.authorized);
      socket.setEncoding('utf8');
      socket.write('hello tls\n');
      socket.on('data', (data: string) => {
        console.log('3. 客户端收到:', data.trim());
        socket.end();
      });
      socket.on('close', () => resolve());
    });
  });

  // 4. ca：把证书加入信任列表，不关校验（正规做法）
  await new Promise<void>((resolve) => {
    const socket = tls.connect({ port, host: '127.0.0.1', ca: cert }, () => {
      console.log(
        '4. authorized:',
        socket.authorized,
        '| 证书 CN:',
        socket.getPeerCertificate().subject.CN
      );
      socket.setEncoding('utf8');
      socket.on('data', (data: string) => console.log('4. 客户端收到:', data.trim()));
      socket.end('bye tls\n');
      socket.on('close', () => resolve());
    });
  });

  // 5. 关闭服务器
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('5. 服务器已关闭');
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
