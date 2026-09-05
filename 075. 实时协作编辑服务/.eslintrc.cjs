module.exports = {
  root: true,
  env: { node: true, browser: true, es2021: true },
  parser: 'espree',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended'
  ],
  plugins: [ 'prettier' ],
  rules: {
    'prettier/prettier': 'warn',
    'no-console': 'off',
    'no-unused-vars': 'warn'
  },
};