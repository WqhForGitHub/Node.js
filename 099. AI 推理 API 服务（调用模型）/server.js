/**
 * AI 推理 API 服务（调用模型）- 纯 Node.js 实现
 *
 * 功能：
 * 1. 统一推理网关：兼容 OpenAI Chat API 协议
 * 2. 多 Provider 后端：OpenAI / Anthropic / Ollama / Mock 本地模型
 * 3. 流式响应（SSE）：边生成边返回
 * 4. 上下文管理：多轮对话、系统提示词
 * 5. API Key 管理：鉴权 + 配额限制
 * 6. 请求限流：基于令牌桶
 * 7. 用量统计：tokens、调用次数、成本
 * 8. 模型路由：按 model 名分发到不同 provider
 * 9. 简易 Web Playground
 *
 * 注意：本服务作为推理 API 网关，可对接任意符合协议的上游模型，
 *       默认包含一个 Mock 模型用于无外部依赖的演示。
 */

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ============ 简易 Tokenizer（按字符近似估算） ============
function estimateTokens(text) {
  if (!text) return 0;
  // 粗略估算：英文 4 字符/token，中文 2 字符/token，混合取均值
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const other = text.length - chinese;
  return Math.ceil(chinese / 1.5 + other / 4);
}

// ============ Provider 基类 ============
class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * @param {Array} messages [{role,content}]
   * @param {Object} options { model, temperature, max_tokens, stream }
   * @param {Function} onChunk 流式回调 (deltaText)
   * @returns {Promise<{content, usage}>}
   */
  async chat(messages, options, onChunk) {
    throw new Error('not implemented');
  }
}

// ============ Mock Provider（不依赖外部 API） ============
class MockProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'mock';
  }

  async chat(messages, options, onChunk) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';

    // 模拟模型基于规则的回复
    const replies = [
      `我已经接收到你的问题：「${lastUser.slice(0, 30)}${lastUser.length > 30 ? '...' : ''}」。`,
      systemPrompt ? `系统提示词指示我作为 ${systemPrompt.slice(0, 20)}... 角色回应。` : '',
      `这是一个 Mock 模型生成的回答示例，演示推理网关的端到端能力。`,
      `当前模型: ${options.model}, temperature=${options.temperature ?? 0.7}.`,
      `若需接入真实模型，请在配置中设置对应 Provider 的 API Key。`,
    ].filter(Boolean);

    const fullText = replies.join('\n');

    // 流式输出
    if (onChunk) {
      const chunks = fullText.match(/.{1,8}/g) || [fullText];
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, 50));
        onChunk(chunk);
      }
    }

    const promptTokens = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
    const completionTokens = estimateTokens(fullText);

    return {
      content: fullText,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  }
}

// ============ OpenAI 兼容 Provider ============
class OpenAICompatibleProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = config.name || 'openai';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
    this.apiKey = config.apiKey;
  }

  async chat(messages, options, onChunk) {
    const payload = {
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: !!onChunk,
    };

    return new Promise((resolve, reject) => {
      const u = new URL('/v1/chat/completions', this.baseUrl);
      const lib = u.protocol === 'https:' ? https : http;
      const data = JSON.stringify(payload);

      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          if (!onChunk) {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
              try {
                const j = JSON.parse(body);
                if (j.error) return reject(new Error(j.error.message));
                resolve({ content: j.choices[0].message.content, usage: j.usage });
              } catch (e) {
                reject(e);
              }
            });
          } else {
            // SSE 流处理
            let buffer = '';
            let fullText = '';
            let usage = null;
            res.on('data', (c) => {
              buffer += c.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                  const j = JSON.parse(data);
                  const delta = j.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    fullText += delta;
                    onChunk(delta);
                  }
                  if (j.usage) usage = j.usage;
                } catch (e) {}
              }
            });
            res.on('end', () =>
              resolve({
                content: fullText,
                usage: usage || {
                  prompt_tokens: 0,
                  completion_tokens: estimateTokens(fullText),
                  total_tokens: estimateTokens(fullText),
                },
              })
            );
          }
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

// ============ 模型路由 ============
class ModelRouter {
  constructor() {
    this.providers = new Map();
    this.modelMap = new Map(); // model name -> provider name

    // 注册默认 Mock provider
    this.register('mock', new MockProvider({}));
    this.routeModel('mock-gpt', 'mock');
    this.routeModel('mock-chat', 'mock');

    // 如果环境变量有 OpenAI key，自动注册
    if (process.env.OPENAI_API_KEY) {
      this.register(
        'openai',
        new OpenAICompatibleProvider({
          baseUrl: 'https://api.openai.com',
          apiKey: process.env.OPENAI_API_KEY,
        })
      );
      this.routeModel('gpt-3.5-turbo', 'openai');
      this.routeModel('gpt-4', 'openai');
      this.routeModel('gpt-4o', 'openai');
    }

    // Ollama 本地（可选）
    if (process.env.OLLAMA_BASE_URL) {
      this.register(
        'ollama',
        new OpenAICompatibleProvider({
          baseUrl: process.env.OLLAMA_BASE_URL,
          apiKey: 'ollama',
          name: 'ollama',
        })
      );
      this.routeModel('llama3', 'ollama');
      this.routeModel('qwen2', 'ollama');
    }
  }

  register(name, provider) {
    this.providers.set(name, provider);
  }

  routeModel(model, providerName) {
    this.modelMap.set(model, providerName);
  }

  getProvider(model) {
    const providerName = this.modelMap.get(model);
    if (!providerName) {
      // 兜底：返回 Mock
      return this.providers.get('mock');
    }
    return this.providers.get(providerName);
  }

  listModels() {
    return Array.from(this.modelMap.keys()).map((m) => ({
      id: m,
      provider: this.modelMap.get(m),
    }));
  }
}

// ============ API Key 管理 ============
class ApiKeyManager {
  constructor() {
    this.keys = new Map();
    // 默认 demo key
    this.create('demo-user', 'sk-demo-12345', { dailyTokenLimit: 100000, rpm: 60 });
  }

  create(userId, key, quota) {
    this.keys.set(key, {
      userId,
      key,
      quota: { dailyTokenLimit: quota.dailyTokenLimit || Infinity, rpm: quota.rpm || 60 },
      usage: { tokensToday: 0, requestCount: 0, lastResetDate: new Date().toDateString(), recentRequests: [] },
      createdAt: Date.now(),
    });
    return key;
  }

  validate(key) {
    return this.keys.get(key);
  }

  // 检查并消费配额
  checkAndConsume(key, tokens = 0) {
    const entry = this.keys.get(key);
    if (!entry) return { ok: false, reason: 'INVALID_KEY' };

    // 每日重置
    const today = new Date().toDateString();
    if (entry.usage.lastResetDate !== today) {
      entry.usage.tokensToday = 0;
      entry.usage.lastResetDate = today;
    }

    // RPM 限流
    const now = Date.now();
    entry.usage.recentRequests = entry.usage.recentRequests.filter((t) => now - t < 60000);
    if (entry.usage.recentRequests.length >= entry.quota.rpm) {
      return { ok: false, reason: 'RATE_LIMITED', retryAfter: 60 };
    }

    // Token 配额
    if (entry.usage.tokensToday + tokens > entry.quota.dailyTokenLimit) {
      return { ok: false, reason: 'QUOTA_EXCEEDED' };
    }

    entry.usage.recentRequests.push(now);
    entry.usage.requestCount++;
    return { ok: true, entry };
  }

  recordUsage(key, tokens) {
    const entry = this.keys.get(key);
    if (entry) entry.usage.tokensToday += tokens;
  }

  getStats(key) {
    const entry = this.keys.get(key);
    return entry ? { userId: entry.userId, usage: entry.usage, quota: entry.quota } : null;
  }
}

// ============ 服务初始化 ============
const router = new ModelRouter();
const keyManager = new ApiKeyManager();

// 用量日志
const logFile = path.join(__dirname, 'usage.log');
function logUsage(record) {
  fs.appendFileSync(logFile, JSON.stringify({ ...record, timestamp: new Date().toISOString() }) + '\n');
}

// ============ HTTP 服务 ============
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  try {
    // Web Playground
    if (u.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(getPlaygroundHTML());
    }

    // 列出模型
    if (u.pathname === '/v1/models' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: router.listModels() }));
    }

    // 用量查询
    if (u.pathname === '/v1/usage' && req.method === 'GET') {
      const key = (req.headers.authorization || '').replace('Bearer ', '');
      const stats = keyManager.getStats(key);
      if (!stats) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Invalid API Key' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(stats));
    }

    // Chat Completions（OpenAI 协议）
    if (u.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const apiKey = (req.headers.authorization || '').replace('Bearer ', '');
      const check = keyManager.checkAndConsume(apiKey);
      if (!check.ok) {
        res.writeHead(check.reason === 'INVALID_KEY' ? 401 : 429, {
          'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({ error: { message: check.reason, code: check.reason } }));
      }

      const body = await readBody(req);
      const { model = 'mock-gpt', messages = [], temperature, max_tokens, stream = false } = body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'messages required' }));
      }

      const provider = router.getProvider(model);
      const requestId = 'chatcmpl-' + crypto.randomBytes(12).toString('hex');

      if (stream) {
        // SSE 流式响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const sendChunk = (delta) => {
          const chunk = {
            id: requestId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        };

        try {
          const result = await provider.chat(messages, { model, temperature, max_tokens }, sendChunk);
          // 结束帧
          res.write(
            `data: ${JSON.stringify({
              id: requestId,
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              usage: result.usage,
            })}\n\n`
          );
          res.write('data: [DONE]\n\n');
          res.end();

          keyManager.recordUsage(apiKey, result.usage.total_tokens);
          logUsage({ apiKey, userId: check.entry.userId, model, usage: result.usage, stream: true });
        } catch (e) {
          res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
          res.end();
        }
      } else {
        // 非流式
        try {
          const result = await provider.chat(messages, { model, temperature, max_tokens });
          const response = {
            id: requestId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
            usage: result.usage,
          };
          keyManager.recordUsage(apiKey, result.usage.total_tokens);
          logUsage({ apiKey, userId: check.entry.userId, model, usage: result.usage, stream: false });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: e.message } }));
        }
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

function getPlaygroundHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 推理 API Playground</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,"Microsoft YaHei",sans-serif;margin:0;padding:20px;background:#1a1a1a;color:#e0e0e0}
.container{max-width:900px;margin:0 auto}
h1{color:#4ade80}
.panel{background:#262626;padding:20px;border-radius:8px;margin-bottom:15px}
input,select,textarea,button{font-size:14px;padding:8px 12px;border:1px solid #444;border-radius:4px;background:#333;color:#e0e0e0;font-family:inherit}
input,select,textarea{width:100%;margin-bottom:10px}
button{background:#4ade80;color:#000;border:none;cursor:pointer;font-weight:bold;padding:10px 20px}
button:hover{background:#22c55e}
label{display:block;margin-bottom:5px;color:#9ca3af;font-size:13px}
.row{display:flex;gap:10px}.row>*{flex:1}
#output{min-height:300px;background:#1a1a1a;padding:15px;border-radius:4px;white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.6;border:1px solid #333}
.usage{font-size:12px;color:#9ca3af;margin-top:10px}
.message{padding:10px;margin-bottom:10px;border-radius:4px}
.message.user{background:#1e3a5f}.message.assistant{background:#1f3d2c}
</style></head><body>
<div class="container">
<h1>AI 推理 API Playground</h1>
<div class="panel">
<label>API Key</label>
<input id="apiKey" value="sk-demo-12345">
<div class="row">
<div><label>模型</label><select id="model"></select></div>
<div><label>Temperature</label><input id="temp" type="number" value="0.7" step="0.1" min="0" max="2"></div>
<div><label>Max Tokens</label><input id="maxTok" type="number" value="512"></div>
</div>
<label>系统提示词（可选）</label>
<textarea id="system" rows="2" placeholder="例如：你是一位专业的助手"></textarea>
<label>用户消息</label>
<textarea id="prompt" rows="4" placeholder="输入你的问题..."></textarea>
<div class="row">
<button onclick="send(false)">发送</button>
<button onclick="send(true)">流式发送</button>
<button onclick="clearOutput()">清空</button>
</div>
</div>
<div class="panel">
<label>响应</label>
<div id="output">在此显示模型回复...</div>
<div class="usage" id="usage"></div>
</div>
</div>
<script>
async function loadModels(){
  const r=await fetch('/v1/models');const j=await r.json();
  document.getElementById('model').innerHTML=j.data.map(m=>\`<option value="\${m.id}">\${m.id} (\${m.provider})</option>\`).join('');
}
loadModels();
function clearOutput(){document.getElementById('output').textContent='';document.getElementById('usage').textContent=''}
async function send(stream){
  const messages=[];
  const sys=document.getElementById('system').value.trim();
  if(sys)messages.push({role:'system',content:sys});
  messages.push({role:'user',content:document.getElementById('prompt').value});
  const body={model:document.getElementById('model').value,messages,temperature:+document.getElementById('temp').value,max_tokens:+document.getElementById('maxTok').value,stream};
  const apiKey=document.getElementById('apiKey').value;
  const out=document.getElementById('output');out.textContent='';
  if(!stream){
    const r=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify(body)});
    const j=await r.json();
    if(j.error){out.textContent='错误: '+JSON.stringify(j.error);return}
    out.textContent=j.choices[0].message.content;
    document.getElementById('usage').textContent='Tokens: prompt='+j.usage.prompt_tokens+', completion='+j.usage.completion_tokens+', total='+j.usage.total_tokens;
  }else{
    const r=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify(body)});
    const reader=r.body.getReader();const dec=new TextDecoder();let buf='';let total='';
    while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value);const lines=buf.split('\\n');buf=lines.pop();
      for(const line of lines){if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue;
        try{const j=JSON.parse(data);const delta=j.choices?.[0]?.delta?.content||'';if(delta){total+=delta;out.textContent=total}
          if(j.usage)document.getElementById('usage').textContent='Tokens: total='+j.usage.total_tokens;}catch(e){}}
    }
  }
}
</script></body></html>`;
}

const PORT = process.env.PORT || 3099;
server.listen(PORT, () => {
  console.log(`AI 推理 API 服务已启动: http://localhost:${PORT}`);
  console.log('可用端点:');
  console.log('  GET  /                    Web Playground');
  console.log('  GET  /v1/models           列出可用模型');
  console.log('  POST /v1/chat/completions OpenAI 兼容聊天 API');
  console.log('  GET  /v1/usage            用量查询');
  console.log('\n演示 API Key: sk-demo-12345');
  console.log('已注册 Provider:', Array.from(router.providers.keys()).join(', '));
  console.log('已注册模型:', router.listModels().map((m) => m.id).join(', '));
});
