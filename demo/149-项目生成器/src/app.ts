import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 项目生成器
 * 模板 + 变量渲染，实现模板变量替换函数（{{var}} 语法）
 */
// ---- 类型定义 ----
interface TemplateDef {
  name: string;
  description: string;
  variables: string[]; // 变量占位符列表
  files: { path: string; content: string }[]; // 含 {{var}} 占位符
}
// ---- 模板变量替换函数 ----
function renderTemplate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}
// ---- 内置模板 ----
const builtinTemplates: TemplateDef[] = [
  {
    name: 'koa-basic',
    description: 'Koa 基础模板',
    variables: ['name', 'author'],
    files: [
      { path: '{{name}}/package.json', content: '{\n  "name": "{{name}}",\n  "author": "{{author}}",\n  "version": "1.0.0"\n}' },
      { path: '{{name}}/src/app.ts', content: 'import Koa from "koa";\n// author: {{author}}\nconst app = new Koa();\napp.listen(3000);\n' },
      { path: '{{name}}/README.md', content: '# {{name}}\n\nby {{author}}\n' },
    ],
  },
  {
    name: 'koa-api',
    description: 'Koa API 模板',
    variables: ['name', 'author', 'version'],
    files: [
      { path: '{{name}}/package.json', content: '{\n  "name": "{{name}}",\n  "author": "{{author}}",\n  "version": "{{version}}"\n}' },
      { path: '{{name}}/src/app.ts', content: 'import Koa from "koa";\nimport Router from "koa-router";\nconst app = new Koa();\nconst router = new Router();\napp.use(router.routes());\napp.listen(3000);\n' },
      { path: '{{name}}/src/routes/index.ts', content: '// {{name}} routes\nexport default {};\n' },
    ],
  },
  {
    name: 'koa-mvc',
    description: 'Koa MVC 模板',
    variables: ['name', 'author'],
    files: [
      { path: '{{name}}/package.json', content: '{\n  "name": "{{name}}",\n  "author": "{{author}}"\n}' },
      { path: '{{name}}/src/controllers/HomeController.ts', content: 'export class HomeController {}\n' },
      { path: '{{name}}/src/models/User.ts', content: 'export class User {}\n' },
      { path: '{{name}}/src/views/index.html', content: '<h1>{{name}}</h1>\n' },
    ],
  },
];
// ---- Service 层 ----
class GeneratorService {
  private templates: Map<string, TemplateDef> = new Map();
  constructor() {
    for (const t of builtinTemplates) this.templates.set(t.name, t);
  }
  list() {
    return Array.from(this.templates.values()).map((t) => ({
      name: t.name,
      description: t.description,
      variables: t.variables,
    }));
  }
  get(name: string) {
    const t = this.templates.get(name);
    if (!t) throw new Error('template 不存在');
    return { name: t.name, description: t.description, variables: t.variables, files: t.files };
  }
  // 注册新模板
  register(def: TemplateDef) {
    if (!def.name) throw new Error('参数缺失: name');
    if (this.templates.has(def.name)) throw new Error('template 已存在');
    this.templates.set(def.name, def);
    return { name: def.name, description: def.description, variables: def.variables, fileCount: def.files.length };
  }
  // 渲染模板生成完整项目结构
  generate(templateName: string, variables: Record<string, string>) {
    const t = this.templates.get(templateName);
    if (!t) throw new Error('template 不存在');
    if (!variables || !variables.name) throw new Error('参数缺失: variables.name');
    const result: Record<string, string> = {};
    for (const f of t.files) {
      const renderedPath = renderTemplate(f.path, variables);
      const renderedContent = renderTemplate(f.content, variables);
      result[renderedPath] = renderedContent;
    }
    return { template: templateName, variables, files: result };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new GeneratorService();

// GET /api/templates - 模板列表
router.get('/api/templates', (ctx) => {
  ctx.body = service.list();
});
// GET /api/templates/:name - 模板详情
router.get('/api/templates/:name', (ctx) => {
  try {
    ctx.body = service.get(ctx.params.name);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});
// POST /api/generate - 渲染模板生成项目
router.post('/api/generate', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.generate(b.template, b.variables || {});
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/templates - 注册新模板
router.post('/api/templates', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.register(b);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[项目生成器] running at http://localhost:' + PORT);
});
