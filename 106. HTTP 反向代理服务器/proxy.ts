/**
 * HTTP 反向代理服务器
 *
 * 根据请求路径前缀把请求转发到不同后端，演示：
 *   - 转发请求方法 / headers / body
 *   - 写回响应状态、头、数据
 *   - 简单 round-robin 负载均衡
 *
 * 运行：npx ts-node proxy.ts 8000
 */
import * as http from 'http';
import * as https from 'https';

interface RouteRule {
  prefix: string;
  targets: string[]; // 例如 https://api.example.com
  rr: number;
}

const rules: RouteRule[] = [
  { prefix: '/api/', targets: ['https://jsonplaceholder.typicode.com'], rr: 0 },
  { prefix: '/img/', targets: ['https://picsum.photos'], rr: 0 },
];

function pickTarget(rule: RouteRule): string {
  const target = rule.targets[rule.rr % rule.targets.length];
  rule.rr++;
  return target;
}

const server = http.createServer((clientReq, clientRes) => {
  const matched = rules.find((r) => clientReq.url?.startsWith(r.prefix));
  if (!matched) {
    clientRes.writeHead(404, { 'Content-Type': 'text/plain' });
    clientRes.end(`No route for ${clientReq.url}`);
    return;
  }

  const target = pickTarget(matched);
  const url = new URL(target);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  // 转发路径保留前缀之后部分
  const forwardPath = clientReq.url!.slice(matched.prefix.length);
  const path =
    url.pathname.replace(/\/$/, '') +
    (forwardPath.startsWith('/') ? forwardPath : '/' + forwardPath);

  const headers = { ...clientReq.headers };
  delete headers.host;
  headers.host = url.host;

  const upstreamReq = lib.request(
    {
      method: clientReq.method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path,
      headers,
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
    }
  );

  upstreamReq.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
    clientRes.end(`Bad Gateway: ${err.message}`);
  });

  clientReq.pipe(upstreamReq);
});

const port = parseInt(process.argv[2] || '8000', 10);
server.listen(port, () => {
  console.log(`反向代理已启动: http://localhost:${port}`);
  console.log('路由:');
  for (const r of rules) console.log(`  ${r.prefix}* -> ${r.targets.join(', ')}`);
});
