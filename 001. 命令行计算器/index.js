const [, , operator, a, b] = process.argv;

const num1 = Number(a);
const num2 = Number(b);

if (!['add', 'sub', 'mul', 'div'].includes(operator)) {
  console.log('用法：node index.js <add|sub|mul|div> <数字1> <数字2>');
  process.exitCode = 1;
} else if (!Number.isFinite(num1) || !Number.isFinite(num2)) {
  console.log('请输入有效数字');
  process.exitCode = 1;
} else {
  let result;

  switch (operator) {
    case 'add':
      result = num1 + num2;
      break;
    case 'sub':
      result = num1 - num2;
      break;
    case 'mul':
      result = num1 * num2;
      break;
    case 'div':
      if (num2 === 0) {
        console.log('除数不能为 0');
        process.exitCode = 1;
        break;
      }
      result = num1 / num2;
      break;
  }

  if (result !== undefined) {
    console.log('计算结果：', result);
  }
}