/**
 * 实时日志监听（tail -f 实现）
 *
 * 通过 fs.watch 以及按行读取的方式，持续输出新增日志内容。
 * 支持文件被截断 / 轮转（变小则重置读取位置）。
 *
 * 运行：npx ts-node tail.ts <file>
 */
import * as fs from 'fs';

function tailFollow(file: string): void {
  let fd: number | null = null;
  let size = 0;
  let pos = 0;

  const open = () => {
    if (fd !== null) fs.closeSync(fd);
    fd = fs.openSync(file, 'r');
    size = fs.statSync(file).size;
    pos = size; // 仅监听新增
    console.log(`开始监听 ${file}，当前位置 ${pos}`);
  };

  open();

  const readNew = () => {
    if (fd === null) return;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return;
    }
    if (stat.size < pos) {
      // 文件被截断/轮转
      console.log('[检测到文件变小，重置位置]');
      open();
      return;
    }
    if (stat.size > pos) {
      const len = stat.size - pos;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, pos);
      pos = stat.size;
      process.stdout.write(buf.toString('utf8'));
    }
  };

  let watcher: fs.FSWatcher | null = null;
  const attach = () => {
    try {
      watcher?.close();
    } catch {
      /* ignore */
    }
    try {
      watcher = fs.watch(file, (event) => {
        if (event === 'change') readNew();
        else if (event === 'rename') {
          // 可能文件轮转，重新打开
          setTimeout(() => {
            try {
              open();
              attach();
            } catch {
              /* 等待重新出现 */
            }
          }, 200);
        }
      });
    } catch {
      // 文件不存在等待
    }
  };
  attach();

  // 兜底轮询，防止某些系统 watch 不可靠
  const timer = setInterval(readNew, 1000);

  process.on('SIGINT', () => {
    clearInterval(timer);
    watcher?.close();
    if (fd !== null) fs.closeSync(fd);
    console.log('\n退出监听');
    process.exit(0);
  });
}

const file = process.argv[2];
if (!file) {
  console.error('用法: ts-node tail.ts <file>');
  process.exit(1);
}
tailFollow(file);
