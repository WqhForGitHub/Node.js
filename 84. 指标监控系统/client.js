// 指标客户端：模拟应用上报
const http = require('http');

const BASE = 'http://127.0.0.1:7400';

function post(path) {
  return new Promise((resolve) => {
    const req = http.request(BASE + path, { method: 'POST' }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', () => resolve());
    req.end();
  });
}

async function main() {
  console.log('开始模拟应用指标上报...');
  setInterval(async () => {
    // 模拟 HTTP 请求
    await post('/metrics/inc?name=http_requests_total');
    if (Math.random() < 0.1) await post('/metrics/inc?name=http_errors_total');
    // 模拟响应时间
    const dur = Math.random() < 0.05 ? 1500 : Math.random() * 500;
    await post('/metrics/observe?name=http_request_duration_ms&value=' + dur.toFixed(2));
    // 模拟 CPU/内存
    await post('/metrics/gauge?name=cpu_usage&value=' + (30 + Math.random() * 40).toFixed(2));
    await post('/metrics/gauge?name=memory_mb&value=' + (200 + Math.random() * 100).toFixed(2));
  }, 200);
}

main();
