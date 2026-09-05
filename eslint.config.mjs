// ESLint v10 flat config
// 文档: https://eslint.org/docs/latest/use/configure/configuration-files
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // 全局忽略: node_modules 与 .git 默认已忽略
  { ignores: ['dist/'] },

  // JS 推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则 (非类型感知版本, 更快; 类型检查交给 tsc --noEmit)
  ...tseslint.configs.recommended,

  // .js / .mjs / .cjs 文件需要手动注入 Node 全局变量 (TS 文件不需要)
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 关闭所有与 Prettier 冲突的格式类规则, 格式交给 Prettier
  prettierConfig,

  // 项目自定义规则
  {
    rules: {
      // 允许以 _ 开头的变量/参数不被使用
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
