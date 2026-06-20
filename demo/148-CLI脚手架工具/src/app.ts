import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * CLI脚手架工具
 * 通过 HTTP 暴露 CLI 命令（纯 koa），实现代码模板生成函数
 */
// ---- 模板生成函数 ----
// 生成项目结构（返回文件树）
function generateProject(projectName: string, template: string) {
  const files: { path: string; content: string }[] = [];
  files.push({
    path: `${projectName}/package.json`,
    content: `{\n  "name": "${projectName}",\n  "version": "1.0.0",\n  "template": "${template}"\n}`,
  });
  files.push({
    path: `${projectName}/README.md`,
    content: `# ${projectName}\n\nGenerated from template: ${template}\n`,
  });
  files.push({
    path: `${projectName}/src/index.ts`,
    content: `console.log('Hello from ${projectName}');\n`,
  });
  if (template === 'koa' || template === 'koa-api') {
    files.push({
      path: `${projectName}/src/app.ts`,
      content: `import Koa from 'koa';\nconst app = new Koa();\napp.listen(3000);\n`,
    });
  }
  return files;
}
// 生成代码片段（controller/model/middleware）
function generateCode(type: string, name: string) {
  if (type === 'controller') {
    return {
      path: `src/controllers/${name}.controller.ts`,
      content: `export class ${capitalize(name)}Controller {\n  async list(ctx: any) {\n    ctx.body = { data: [] };\n  }\n  async detail(ctx: any) {\n    ctx.body = { id: ctx.params.id };\n  }\n}\n`,
    };
  }
  if (type === 'model') {
    return {
      path: `src/models/${name}.model.ts`,
      content: `export interface ${capitalize(name)} {\n  id: number;\n  createdAt: number;\n}\n\nexport class ${capitalize(name)}Model {\n  private data: ${capitalize(name)}[] = [];\n  findAll() { return this.data; }\n}\n`,
    };
  }
  if (type === 'middleware') {
    return {
      path: `src/middlewares/${name}.middleware.ts`,
      content: `import { Context, Next } from 'koa';\nexport function ${name}Middleware() {\n  return async (ctx: Context, next: Next) => {\n    console.log('[${name}]', ctx.path);\n    await next();\n  };\n}\n`,
    };
  }
  throw new Error('未知 type');
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// ---- Service 层 ----
class CLIService {
  commands() {
    return [
      { name: 'init', desc: '初始化项目', method: 'POST', path: '/api/commands/init' },
      { name: 'generate', desc: '生成代码片段', method: 'POST', path: '/api/commands/generate' },
      { name: 'build', desc: '构建项目', method: 'POST', path: '/api/commands/build' },
      { name: 'help', desc: '帮助信息', method: 'GET', path: '/api/commands' },
    ];
  }
  init(projectName: string, template: string) {
    if (!projectName) throw new Error('参数缺失: projectName');
    const files = generateProject(projectName, template || 'basic');
    return { projectName, template: template || 'basic', files };
  }
  generate(type: string, name: string) {
    if (!type || !name) throw new Error('参数缺失: type, name');
    const code = generateCode(type, name);
    return { type, name, ...code };
  }
  build() {
    const start = Date.now();
    // mock 构建
    const success = Math.random() > 0.1;
    const duration = Date.now() - start + Math.floor(Math.random() * 1000);
    return {
      success,
      output: success ? 'Build succeeded. 0 errors.' : 'Build failed. Syntax error.',
      duration,
    };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new CLIService();

// GET /api/commands - 命令列表
router.get('/api/commands', (ctx) => {
  ctx.body = service.commands();
});
// POST /api/commands/init - 初始化项目
router.post('/api/commands/init', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.init(b.projectName, b.template);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/commands/generate - 生成代码片段
router.post('/api/commands/generate', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.generate(b.type, b.name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/commands/build - mock 构建
router.post('/api/commands/build', (ctx) => {
  ctx.body = service.build();
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[CLI脚手架工具] running at http://localhost:' + PORT);
});
