// 分词器：支持英文 + 简单中文（按字切分）
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  '的',
  '了',
  '是',
  '在',
  '和',
  '我',
  '你',
  '他',
  '她',
  '它',
]);

class Tokenizer {
  static tokenize(text) {
    if (!text) return [];
    const tokens = [];
    // 转小写
    text = text.toLowerCase();
    // 提取英文单词、数字、单个中文字
    const re = /([a-z0-9]+)|([\u4e00-\u9fa5])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const tok = m[1] || m[2];
      if (tok && !STOP_WORDS.has(tok)) tokens.push(tok);
    }
    return tokens;
  }

  // 简单词干提取（英文复数等）
  static stem(word) {
    if (word.length <= 3) return word;
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es') || word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
    return word;
  }

  static analyze(text) {
    return this.tokenize(text).map((t) => this.stem(t));
  }
}

module.exports = Tokenizer;
