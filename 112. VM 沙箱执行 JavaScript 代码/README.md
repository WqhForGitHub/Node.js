# 112. VM 沙箱执行 JavaScript 代码

使用 Node.js `vm` 创建受限 context，运行用户输入的 JavaScript：禁用定时器、自定义 `console` 把输出收集到 `__log__`，通过 `timeout` 限制 CPU 时间。

## 运行

```bash
npx ts-node sandbox.ts
```

交互示例：

```js
const arr = [1,2,3].map(x => x*x);
console.log('sum', arr.reduce((a,b)=>a+b,0));
result = arr;
END
```

## 要点

- `vm.createContext(sandbox)` 提供受控的全局对象。
- `vm.runInContext(code, ctx, { timeout: 1000 })` 限时防死循环。
- 通过 `result` 字段拿回 sandbox 计算结果。