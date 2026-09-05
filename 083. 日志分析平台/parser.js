// 日志解析器：支持多种格式
class LogParser {
  // 通用日志：[LEVEL] timestamp message
  static parseGeneric(line) {
    const m = line.match(/^\[(\w+)\]\s+(\S+)\s+(.*)$/);
    if (m) return { level: m[1].toLowerCase(), ts: Date.parse(m[2]) || Date.now(), message: m[3] };
    return null;
  }

  // Apache/Nginx access log
  static parseAccess(line) {
    const m = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) (\d+|-)/);
    if (!m) return null;
    return {
      ip: m[1],
      ts: Date.parse(m[2].replace(':', ' ')) || Date.now(),
      method: m[3],
      path: m[4],
      status: parseInt(m[5]),
      size: m[6] === '-' ? 0 : parseInt(m[6]),
      level: parseInt(m[5]) >= 500 ? 'error' : parseInt(m[5]) >= 400 ? 'warn' : 'info',
    };
  }

  // 自动检测
  static parse(line) {
    if (!line || !line.trim()) return null;
    // 尝试 JSON
    if (line.startsWith('{')) {
      try {
        const obj = JSON.parse(line);
        obj.ts = obj.ts || obj.timestamp || Date.now();
        obj.level = obj.level || 'info';
        obj.message = obj.message || obj.msg || '';
        return obj;
      } catch {}
    }
    return (
      this.parseGeneric(line) ||
      this.parseAccess(line) || {
        level: 'info',
        ts: Date.now(),
        message: line,
        raw: true,
      }
    );
  }
}

module.exports = LogParser;
