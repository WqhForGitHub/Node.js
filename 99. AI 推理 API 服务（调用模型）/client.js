/**
 * AI 推理 API 客户端示例
 */
const http = require('http');

class AIClient {
  constructor(baseUrl = 'http://localhost:3099', apiKey = 'sk-demo-12345') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async chat(messages, options = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL('/v1/chat/completions', this.baseUrl);
      const body = JSON.stringify({ model: 'mock-gpt', messages, ...options });
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async chatStream(messages, options = {}, onChunk) {
    return new Promise((resolve, reject) => {
      const u = new URL('/v1/chat/completions', this.baseUrl);
      const body = JSON.stringify({ model: 'mock-gpt', messages, stream: true, ...options });
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let buffer = '';
          let fullText = '';
          res.on('data', (c) => {
            buffer += c.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const d = line.slice(5).trim();
              if (d === '[DONE]') continue;
              try {
                const j = JSON.parse(d);
                const delta = j.choices?.[0]?.delta?.content || '';
                if (delta) {
                  fullText += delta;
                  onChunk(delta);
                }
              } catch (e) {}
            }
          });
          res.on('end', () => resolve(fullText));
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

// 演示
async function demo() {
  const client = new AIClient();

  console.log('===== 演示 1: 普通对话 =====');
  const r1 = await client.chat([
    { role: 'system', content: '你是一个友好的助手' },
    { role: 'user', content: '请介绍一下 Node.js 的事件循环' },
  ]);
  console.log('回复:', r1.choices[0].message.content);
  console.log('Tokens:', r1.usage);

  console.log('\n===== 演示 2: 流式对话 =====');
  process.stdout.write('回复: ');
  await client.chatStream(
    [{ role: 'user', content: '解释什么是分布式系统' }],
    { temperature: 0.5 },
    (delta) => process.stdout.write(delta)
  );
  console.log('\n');

  console.log('===== 演示 3: 多轮对话 =====');
  const history = [
    { role: 'system', content: '你是数学老师' },
    { role: 'user', content: '什么是质数?' },
  ];
  const r2 = await client.chat(history);
  console.log('AI:', r2.choices[0].message.content);
  history.push({ role: 'assistant', content: r2.choices[0].message.content });
  history.push({ role: 'user', content: '请举例说明' });
  const r3 = await client.chat(history);
  console.log('AI:', r3.choices[0].message.content);
}

if (require.main === module) {
  demo().catch(console.error);
}

module.exports = AIClient;
