// AOF 持久化：追加写命令日志，启动时回放
const fs = require('fs');
const path = require('path');

class AOF {
  constructor(file = path.join(__dirname, 'memdb.aof')) {
    this.file = file;
    this.fd = fs.openSync(this.file, 'a+');
  }
  append(cmd) {
    fs.writeSync(this.fd, JSON.stringify(cmd) + '\n');
  }
  // 回放日志
  replay(executor) {
    if (!fs.existsSync(this.file)) return 0;
    const content = fs.readFileSync(this.file, 'utf8');
    let n = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        executor(JSON.parse(line));
        n++;
      } catch (e) {
        console.error('回放错误:', e.message);
      }
    }
    return n;
  }
  close() {
    fs.closeSync(this.fd);
  }
}

module.exports = AOF;
