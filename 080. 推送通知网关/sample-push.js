// 业务方推送示例 - 通过 HTTP API 推送
const http = require('http');

const TOKEN = 'demo-token-12345';

function push(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: 8000, path: '/api/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-Token': TOKEN
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

(async () => {
  // 广播
  let r = await push({
    target: 'broadcast',
    payload: { title: '系统公告', body: '今晚 22:00 系统维护' },
    qos: 1
  });
  console.log('广播结果:', r);

  // 按主题
  r = await push({
    target: 'topic', topic: 'news',
    payload: { title: '热点新闻', body: 'Node.js v22 LTS 发布' }
  });
  console.log('主题推送结果:', r);

  // 按用户
  r = await push({
    target: 'user', userId: 'alice',
    payload: { title: '订单消息', body: '您的订单已发货', data: { orderId: '12345' } },
    qos: 1
  });
  console.log('用户推送结果:', r);
})();
