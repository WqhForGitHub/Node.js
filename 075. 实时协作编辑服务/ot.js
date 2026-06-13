// 操作转换 (OT) 引擎 - 简化版用于文本协作
// 操作类型：{ type: 'insert', pos, text } | { type: 'delete', pos, len }

function transform(op1, op2) {
  // 转换 op1：op2 已经被应用了，op1 需要在新版本上正确执行
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op2.pos <= op1.pos) {
      return { ...op1, pos: op1.pos + op2.text.length };
    }
    return op1;
  }
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op2.pos + op2.len <= op1.pos) {
      return { ...op1, pos: op1.pos - op2.len };
    } else if (op2.pos >= op1.pos) {
      return op1;
    } else {
      return { ...op1, pos: op2.pos };
    }
  }
  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op2.pos <= op1.pos) {
      return { ...op1, pos: op1.pos + op2.text.length };
    } else if (op2.pos >= op1.pos + op1.len) {
      return op1;
    } else {
      // 插入发生在删除区间内，扩大删除长度
      return { ...op1, len: op1.len + op2.text.length };
    }
  }
  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op2.pos + op2.len <= op1.pos) {
      return { ...op1, pos: op1.pos - op2.len };
    } else if (op2.pos >= op1.pos + op1.len) {
      return op1;
    } else {
      // 重叠
      const start = Math.max(op1.pos, op2.pos);
      const end = Math.min(op1.pos + op1.len, op2.pos + op2.len);
      const overlap = end - start;
      return { ...op1, len: op1.len - overlap, pos: Math.min(op1.pos, op2.pos) };
    }
  }
  return op1;
}

function applyOp(text, op) {
  if (op.type === 'insert') {
    return text.slice(0, op.pos) + op.text + text.slice(op.pos);
  } else if (op.type === 'delete') {
    return text.slice(0, op.pos) + text.slice(op.pos + op.len);
  }
  return text;
}

module.exports = { transform, applyOp };
