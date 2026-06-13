/**
 * 短链编码生成器
 * 基于 Base62 编码，将自增 ID 转换为短字符串
 */

const BASE62_CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = BASE62_CHARS.length;

/**
 * 将数字 ID 编码为 Base62 短码
 * @param {number} id - 自增 ID
 * @returns {string} Base62 编码后的短码
 */
function encode(id) {
  if (id === 0) return BASE62_CHARS[0];
  let code = "";
  let num = id;
  while (num > 0) {
    code = BASE62_CHARS[num % BASE] + code;
    num = Math.floor(num / BASE);
  }
  return code;
}

/**
 * 将 Base62 短码解码回数字 ID
 * @param {string} code - Base62 短码
 * @returns {number} 解码后的 ID
 */
function decode(code) {
  let id = 0;
  for (let i = 0; i < code.length; i++) {
    const charIndex = BASE62_CHARS.indexOf(code[i]);
    if (charIndex === -1) {
      throw new Error(`无效的短码字符: ${code[i]}`);
    }
    id = id * BASE + charIndex;
  }
  return id;
}

module.exports = { encode, decode };
