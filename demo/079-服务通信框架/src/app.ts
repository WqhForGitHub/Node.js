import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 服务通信框架
 * JSON-RPC 服务通信
 * 服务通信: 模拟 RPC 调用 + 客户端
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// 模拟的远程方法注册表
const methods: Record<string, (params: any) => any> = {
  'math.add': (p: any) => p.a + p.b,
  'math.mul': (p: any) => p.a * p.b,
  'user.get': (p: any) => ({ id: p.id, name: 'user-' + p.id }),
};

// JSON-RPC 风格
router.post('/rpc', (ctx) => {
  const { jsonrpc, id, method, params } = (ctx.request.body || {}) as {
    jsonrpc: string;
    id: any;
    method: string;
    params: any;
  };
  if (jsonrpc !== '2.0') {
    ctx.body = { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    return;
  }
  const fn = methods[method];
  if (!fn) {
    ctx.body = { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
    return;
  }
  try {
    ctx.body = { jsonrpc: '2.0', id, result: fn(params) };
  } catch (e) {
    ctx.body = { jsonrpc: '2.0', id, error: { code: -32000, message: (e as Error).message } };
  }
});

// RPC 客户端封装
async function rpcCall(method: string, params: any, id = 1) {
  // 真实场景用 fetch 调用远端
  const fn = methods[method];
  return fn ? fn(params) : undefined;
}

router.get('/demo', async (ctx) => {
  const sum = await rpcCall('math.add', { a: 2, b: 3 });
  const user = await rpcCall('user.get', { id: 7 });
  ctx.body = { sum, user };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[服务通信框架] running'));
