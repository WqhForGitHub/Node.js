import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 后端模板工厂
 * 组合多种后端模板，不同类型生成不同文件结构（microservice 生成多 service 目录，crud-service 根据 entities 生成 model/controller）
 */
// ---- 类型定义 ----
type FactoryType = 'rest-api' | 'crud-service' | 'realtime-app' | 'microservice';
interface BuildConfig {
  name: string;
  entities?: string[];
  features?: string[];
}
interface Preset {
  id: string;
  name: string;
  type: FactoryType;
  config: BuildConfig;
}
// ---- 工厂生成函数 ----
function buildRestApi(cfg: BuildConfig): { path: string; content: string }[] {
  return [
    {
      path: `${cfg.name}/package.json`,
      content: `{\n  "name": "${cfg.name}",\n  "type": "rest-api"\n}`,
    },
    {
      path: `${cfg.name}/src/app.ts`,
      content: `import Koa from 'koa';\nimport Router from 'koa-router';\nconst app = new Koa();\nconst router = new Router();\napp.use(router.routes());\napp.listen(3000);\n`,
    },
    { path: `${cfg.name}/src/routes/index.ts`, content: `export default {};\n` },
  ];
}
function buildCrudService(cfg: BuildConfig): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [
    {
      path: `${cfg.name}/package.json`,
      content: `{\n  "name": "${cfg.name}",\n  "type": "crud-service"\n}`,
    },
    {
      path: `${cfg.name}/src/app.ts`,
      content: `import Koa from 'koa';\nconst app = new Koa();\napp.listen(3000);\n`,
    },
  ];
  // 根据 entities 生成对应 model/controller
  for (const e of cfg.entities || []) {
    files.push({
      path: `${cfg.name}/src/models/${e}.model.ts`,
      content: `export interface ${cap(e)} {\n  id: number;\n  createdAt: number;\n}\nexport class ${cap(e)}Model {\n  private list: ${cap(e)}[] = [];\n  findAll() { return this.list; }\n  create(data: any) { return { id: Date.now(), ...data }; }\n}\n`,
    });
    files.push({
      path: `${cfg.name}/src/controllers/${e}.controller.ts`,
      content: `export class ${cap(e)}Controller {\n  async list(ctx: any) { ctx.body = []; }\n  async create(ctx: any) { ctx.status = 201; }\n  async detail(ctx: any) { ctx.body = { id: ctx.params.id }; }\n  async update(ctx: any) { ctx.body = { id: ctx.params.id }; }\n  async remove(ctx: any) { ctx.status = 204; }\n}\n`,
    });
  }
  return files;
}
function buildRealtimeApp(cfg: BuildConfig): { path: string; content: string }[] {
  return [
    {
      path: `${cfg.name}/package.json`,
      content: `{\n  "name": "${cfg.name}",\n  "type": "realtime-app"\n}`,
    },
    {
      path: `${cfg.name}/src/app.ts`,
      content: `import Koa from 'koa';\nconst app = new Koa();\napp.listen(3000);\n`,
    },
    {
      path: `${cfg.name}/src/ws/server.ts`,
      content: `// WebSocket server\nexport function start() { console.log('ws://localhost:3001'); }\n`,
    },
    {
      path: `${cfg.name}/src/events/handler.ts`,
      content: `export function onMessage(msg: any) { console.log(msg); }\n`,
    },
  ];
}
function buildMicroservice(cfg: BuildConfig): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [
    {
      path: `${cfg.name}/package.json`,
      content: `{\n  "name": "${cfg.name}",\n  "type": "microservice"\n}`,
    },
    { path: `${cfg.name}/README.md`, content: `# ${cfg.name}\n\nMicroservice composition.\n` },
  ];
  // 生成多个 service 目录
  const services = cfg.entities && cfg.entities.length ? cfg.entities : ['user', 'order'];
  for (const s of services) {
    files.push({
      path: `${cfg.name}/services/${s}/index.ts`,
      content: `import Koa from 'koa';\nconst app = new Koa();\napp.listen(0);\nexport default app;\n`,
    });
    files.push({
      path: `${cfg.name}/services/${s}/handler.ts`,
      content: `export function handle() { return '${s} ok'; }\n`,
    });
  }
  files.push({
    path: `${cfg.name}/gateway/index.ts`,
    content: `import Koa from 'koa';\nconst app = new Koa();\napp.listen(3000);\n`,
  });
  return files;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// ---- Service 层 ----
class FactoryService {
  private presets: Preset[] = [
    { id: 'p1', name: 'REST API 基础', type: 'rest-api', config: { name: 'my-api' } },
    {
      id: 'p2',
      name: 'CRUD 用户服务',
      type: 'crud-service',
      config: { name: 'user-service', entities: ['user'] },
    },
    {
      id: 'p3',
      name: '实时聊天',
      type: 'realtime-app',
      config: { name: 'chat-app', features: ['websocket'] },
    },
    {
      id: 'p4',
      name: '电商微服务',
      type: 'microservice',
      config: { name: 'ecommerce', entities: ['user', 'order', 'payment'] },
    },
  ];
  types() {
    return [
      { type: 'rest-api', desc: 'REST API 应用' },
      { type: 'crud-service', desc: 'CRUD 服务（按 entities 生成 model/controller）' },
      { type: 'realtime-app', desc: '实时应用（WebSocket）' },
      { type: 'microservice', desc: '微服务（多 service 目录）' },
    ];
  }
  build(type: FactoryType, config: BuildConfig) {
    if (!['rest-api', 'crud-service', 'realtime-app', 'microservice'].includes(type))
      throw new Error('未知 type');
    if (!config || !config.name) throw new Error('参数缺失: config.name');
    let files: { path: string; content: string }[];
    if (type === 'rest-api') files = buildRestApi(config);
    else if (type === 'crud-service') files = buildCrudService(config);
    else if (type === 'realtime-app') files = buildRealtimeApp(config);
    else files = buildMicroservice(config);
    return { type, config, fileCount: files.length, files };
  }
  listPresets() {
    return this.presets.map((p) => ({ id: p.id, name: p.name, type: p.type, config: p.config }));
  }
  applyPreset(id: string) {
    const p = this.presets.find((x) => x.id === id);
    if (!p) throw new Error('preset 不存在');
    return this.build(p.type, p.config);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new FactoryService();

// GET /api/factory/types - 模板类型
router.get('/api/factory/types', (ctx) => {
  ctx.body = service.types();
});
// POST /api/factory/build - 构建项目
router.post('/api/factory/build', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.build(b.type, b.config || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/factory/presets - 预设方案
router.get('/api/factory/presets', (ctx) => {
  ctx.body = service.listPresets();
});
// POST /api/factory/presets/:id/apply - 应用预设
router.post('/api/factory/presets/:id/apply', (ctx) => {
  try {
    ctx.body = service.applyPreset(ctx.params.id);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[后端模板工厂] running at http://localhost:' + PORT);
});
