/**
 * 003-02 - CommonJS 导出示例
 *
 * `export = xxx` 是 TypeScript 对 JavaScript 中
 * `module.exports = xxx` 的类型安全写法。
 */

function greet(name: string): string {
  return `你好，${name}！`;
}

function farewell(name: string): string {
  return `再见，${name}！`;
}

// 等价于 JavaScript 的：module.exports = { greet, farewell }
export = { greet, farewell };
