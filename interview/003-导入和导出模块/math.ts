/**
 * 003-01 - ESM（ES Module）导出示例
 *
 * export：命名导出（可以多个）
 * export default：默认导出（每个模块只能有一个）
 */

// ---------- 命名导出 ----------
export const PI: number = 3.14159;

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

// ---------- 默认导出 ----------
export default class Calculator {
  static version: string = '1.0.0';

  double(n: number): number {
    return n * 2;
  }
}
