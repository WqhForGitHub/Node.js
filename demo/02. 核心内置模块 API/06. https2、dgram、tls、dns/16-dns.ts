/**
 * Demo 16 - dns 模块（域名解析：lookup 走系统配置；resolve 系列走 DNS 服务器）
 * 运行：node "demo/02. 核心内置模块 API/06. https2、dgram、tls、dns/16-dns.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dns = require('node:dns') as typeof import('node:dns');

async function main(): Promise<void> {
  const dnsP = dns.promises; // promise 版 API

  // 1. lookup：走系统解析器（hosts / 系统缓存），最常用
  const addr = await dnsP.lookup('localhost');
  console.log(`1. lookup localhost → ${addr.address} (IPv${addr.family})`);

  // 2. lookup 选项：all 返回全部地址，family 限定 IPv4/IPv6
  const list = await dnsP.lookup('localhost', { all: true, family: 4 });
  console.log(
    '2. 全部 IPv4:',
    list.map((a) => a.address)
  );

  // 3. resolve4 / resolve6：真正向 DNS 服务器发查询（需联网）
  try {
    console.log('3. resolve4 example.com →', await dnsP.resolve4('example.com'));
  } catch (err) {
    console.log('3. 查询失败（可能无网络）:', (err as NodeJS.ErrnoException).code);
  }

  // 4. 其他记录类型：resolveMx 邮件服务器、resolveTxt 文本、resolveCname 别名…
  try {
    console.log('4. resolveMx gmail.com →', await dnsP.resolveMx('gmail.com'));
  } catch (err) {
    console.log('4. 查询失败（可能无网络）:', (err as NodeJS.ErrnoException).code);
  }

  // 5. reverse：IP 反查域名（PTR 记录）
  try {
    console.log('5. reverse 8.8.8.8 →', await dnsP.reverse('8.8.8.8'));
  } catch (err) {
    console.log('5. 查询失败（可能无网络）:', (err as NodeJS.ErrnoException).code);
  }

  // 6. Resolver：独立解析器实例，可自定义 DNS 服务器
  console.log('6. 系统 DNS:', dns.getServers()[0]);
  const resolver = new dnsP.Resolver();
  resolver.setServers(['8.8.8.8']); // 改用 Google 公共 DNS
  try {
    console.log('6. 经 8.8.8.8 解析 example.com →', await resolver.resolve4('example.com'));
  } catch (err) {
    console.log('6. 查询失败（可能无网络）:', (err as NodeJS.ErrnoException).code);
  }

  // 7. 回调版：同一套 API 都有 promise 与回调两种形式
  dns.lookup('localhost', (err, address, family) => {
    if (err) throw err;
    console.log(`7. 回调版 lookup localhost → ${address} (IPv${family})`);
  });
}

main();
