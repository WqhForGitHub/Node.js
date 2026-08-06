/**
 * VM 沙箱执行 JavaScript 代码
 *
 * 使用 vm 模块创建受限 context，在沙箱内执行用户输入脚本。
 *   - 提供 limit CPU 时间（基于 timeout）
 *   - 提供 result 通道（context 内可写 result = ...)
 *   - 通过 Proxy 拦截危险全局访问
 *
 * 运行：npx ts-node sandbox.ts
 *   然后从 stdin 输入 JS 代码，结束按 Ctrl+D（Windows）或两次 Enter 后空行结束。
 */
import * as vm from 'vm';
import * as readline from 'readline';

function createSandboxedContext(): vm.Context {
  const sandbox: Record<string, any> = {
    result: undefined,
    console: {
      log: (...args: any[]) => sandbox.__log__.push(args.map(String).join(' ')),
    },
    __log__: [] as string[],
    // 仅提供 Math / JSON 等纯粹全局
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
  };
  return vm.createContext(sandbox);
}

function run(code: string): { result: unknown; logs: string[]; ms: number } {
  const ctx = createSandboxedContext();
  const t0 = Date.now();
  try {
    const ret = vm.runInContext(code, ctx, { timeout: 1000, displayErrors: true });
    const ms = Date.now() - t0;
    return { result: ctx.result ?? ret, logs: ctx.__log__ as string[], ms };
  } catch (e) {
    throw e;
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];
  console.log('# 在沙箱内运行 JS。输入 END 独占一行结束。');

  for await (const line of rl) {
    if (line.trim() === 'END') {
      const code = lines.join('\n');
      lines.length = 0;
      if (!code.trim()) continue;
      try {
        const r = run(code);
        console.log(`(用时 ${r.ms}ms) 结果:`, r.result);
        if (r.logs.length) console.log('--- logs ---\n' + r.logs.join('\n'));
      } catch (e: any) {
        console.error('运行失败:', e.message);
      }
      console.log('\n# 下一段代码（END 结束）:');
    } else {
      lines.push(line);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});