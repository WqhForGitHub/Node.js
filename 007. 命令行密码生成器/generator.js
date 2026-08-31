/**
 * 密码生成器核心模块
 * 使用 crypto 模块保证密码的随机性与安全性
 */
const crypto = require('crypto');

// 字符集定义
const CHAR_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
};

// 易混淆字符（用于排除）
const SIMILAR_CHARS = 'il1Lo0O';

/**
 * 使用加密安全的随机数从字符集中挑选一个字符
 * @param {string} charset 字符集
 * @returns {string} 随机字符
 */
function getRandomChar(charset) {
  const max = Math.floor(0xffffffff / charset.length) * charset.length;
  let randomValue;
  do {
    randomValue = crypto.randomBytes(4).readUInt32BE(0);
  } while (randomValue >= max);
  return charset[randomValue % charset.length];
}

/**
 * 打乱字符串（Fisher-Yates 洗牌）
 * @param {string} str 待打乱字符串
 * @returns {string} 打乱后的字符串
 */
function shuffleString(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * 生成单个密码
 * @param {Object} options 生成选项
 * @param {number} options.length 密码长度
 * @param {boolean} options.lowercase 是否包含小写字母
 * @param {boolean} options.uppercase 是否包含大写字母
 * @param {boolean} options.numbers 是否包含数字
 * @param {boolean} options.symbols 是否包含符号
 * @param {boolean} options.excludeSimilar 是否排除易混淆字符
 * @returns {string} 生成的密码
 */
function generatePassword(options) {
  const {
    length = 12,
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = false,
    excludeSimilar = false,
  } = options;

  if (length < 1) {
    throw new Error('密码长度必须大于 0');
  }

  // 构建字符池
  const enabledSets = [];
  if (lowercase) enabledSets.push(filterChars(CHAR_SETS.lowercase, excludeSimilar));
  if (uppercase) enabledSets.push(filterChars(CHAR_SETS.uppercase, excludeSimilar));
  if (numbers) enabledSets.push(filterChars(CHAR_SETS.numbers, excludeSimilar));
  if (symbols) enabledSets.push(filterChars(CHAR_SETS.symbols, excludeSimilar));

  if (enabledSets.length === 0) {
    throw new Error('至少需要启用一种字符类型');
  }

  if (length < enabledSets.length) {
    throw new Error(`密码长度（${length}）小于已启用的字符类型数（${enabledSets.length}）`);
  }

  // 保证每种字符类型至少出现一次
  let password = '';
  for (const set of enabledSets) {
    password += getRandomChar(set);
  }

  // 用所有可用字符填充剩余位置
  const allChars = enabledSets.join('');
  for (let i = password.length; i < length; i++) {
    password += getRandomChar(allChars);
  }

  return shuffleString(password);
}

/**
 * 过滤掉易混淆字符
 */
function filterChars(charset, excludeSimilar) {
  if (!excludeSimilar) return charset;
  return charset
    .split('')
    .filter((c) => !SIMILAR_CHARS.includes(c))
    .join('');
}

/**
 * 批量生成密码
 * @param {Object} options 生成选项
 * @param {number} count 生成数量
 * @returns {string[]} 密码列表
 */
function generateBatch(options, count = 1) {
  const passwords = [];
  for (let i = 0; i < count; i++) {
    passwords.push(generatePassword(options));
  }
  return passwords;
}

/**
 * 评估密码强度
 * @param {string} password 密码
 * @returns {Object} 强度评估结果
 */
function evaluateStrength(password) {
  let score = 0;
  const length = password.length;

  // 长度评分
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (length >= 20) score += 1;

  // 字符多样性评分
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // 字符集大小估算熵值
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  const entropy = length * Math.log2(charsetSize || 1);

  let level;
  if (score <= 3) level = '弱';
  else if (score <= 5) level = '中';
  else if (score <= 7) level = '强';
  else level = '极强';

  return {
    score,
    level,
    entropy: entropy.toFixed(2),
    length,
  };
}

module.exports = {
  generatePassword,
  generateBatch,
  evaluateStrength,
  CHAR_SETS,
};
