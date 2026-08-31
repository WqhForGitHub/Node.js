#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { spawn } = require('child_process');

// ─── 配置 ──────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const TMP_DIR = path.join(DATA_DIR, 'tmp');

// ─── 终端颜色 ──────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function color(text, c) {
  return `${c}${text}${C.reset}`;
}

// ─── 存储 ──────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function loadNotes() {
  ensureDataDir();
  if (!fs.existsSync(NOTES_FILE)) return { nextId: 1, notes: [] };
  try {
    const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.notes) data.notes = [];
    if (!data.nextId) {
      data.nextId = data.notes.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;
    }
    return data;
  } catch (e) {
    console.error(color(`读取笔记失败: ${e.message}`, C.red));
    return { nextId: 1, notes: [] };
  }
}

function saveNotes(data) {
  ensureDataDir();
  const tmp = NOTES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, NOTES_FILE);
}

// ─── 模型操作 ──────────────────────────────────────────────

function createNote(data, { title, content, tags }) {
  const now = Date.now();
  const note = {
    id: data.nextId++,
    title: title || '(无标题)',
    content: content || '',
    tags: Array.isArray(tags) ? tags : [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  data.notes.push(note);
  return note;
}

function findNote(data, id) {
  return data.notes.find((n) => n.id === Number(id));
}

function removeNote(data, id) {
  const idx = data.notes.findIndex((n) => n.id === Number(id));
  if (idx < 0) return null;
  return data.notes.splice(idx, 1)[0];
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function filterNotes(notes, { keyword, tag }) {
  return notes.filter((n) => {
    if (tag && !n.tags.includes(tag)) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      const hay = (n.title + '\n' + n.content + '\n' + n.tags.join(',')).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

// ─── 格式化 ──────────────────────────────────────────────

function formatDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncate(str, n) {
  const s = (str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function renderTable(notes) {
  if (notes.length === 0) {
    console.log(color('  (没有笔记)', C.gray));
    return;
  }
  const header =
    '  ' +
    color('ID'.padEnd(4), C.bold) +
    color('P ', C.bold) +
    color('标题'.padEnd(28), C.bold) +
    color('标签'.padEnd(20), C.bold) +
    color('更新时间', C.bold);
  console.log(header);
  console.log(color('  ' + '─'.repeat(76), C.gray));
  for (const n of notes) {
    const pin = n.pinned ? color('★ ', C.yellow) : '  ';
    const title = truncate(n.title, 26).padEnd(28);
    const tags = truncate(n.tags.map((t) => '#' + t).join(' '), 18).padEnd(20);
    const time = color(formatDate(n.updatedAt), C.gray);
    const idStr = color(String(n.id).padEnd(4), C.cyan);
    console.log(`  ${idStr}${pin}${title}${tags}${time}`);
  }
}

function renderNote(n) {
  console.log();
  console.log(color(`  #${n.id} ${n.pinned ? '★ ' : ''}${n.title}`, C.bold + C.cyan));
  console.log(
    color(`  创建: ${formatDate(n.createdAt)}    更新: ${formatDate(n.updatedAt)}`, C.gray)
  );
  if (n.tags.length > 0) {
    console.log('  ' + n.tags.map((t) => color('#' + t, C.magenta)).join(' '));
  }
  console.log(color('  ' + '─'.repeat(60), C.gray));
  const body = n.content || color('(空内容)', C.gray);
  for (const line of body.split('\n')) console.log('  ' + line);
  console.log();
}

// ─── 交互工具 ──────────────────────────────────────────────

function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a)));
}

// 多行输入：以单独一行 "." 或 EOF 结束
async function readMultiline(rl, prompt) {
  console.log(color(prompt, C.gray));
  const lines = [];
  while (true) {
    const line = await ask(rl, '  > ');
    if (line === '.') break;
    lines.push(line);
  }
  return lines.join('\n');
}

// 调用外部编辑器编辑内容
function editInEditor(initial) {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    const editor =
      process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'vi');
    const tmpFile = path.join(
      TMP_DIR,
      `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
    );
    fs.writeFileSync(tmpFile, initial || '', 'utf-8');

    const child = spawn(editor, [tmpFile], { stdio: 'inherit' });
    child.on('exit', () => {
      try {
        const content = fs.readFileSync(tmpFile, 'utf-8');
        fs.unlinkSync(tmpFile);
        resolve(content);
      } catch (e) {
        reject(e);
      }
    });
    child.on('error', reject);
  });
}

function parseTags(input) {
  return (input || '')
    .split(/[,，\s]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

// ─── 子命令实现 ──────────────────────────────────────────────

async function cmdAdd(args) {
  const data = loadNotes();
  const rl = createRL();
  try {
    const title = (await ask(rl, color('标题: ', C.cyan))).trim();
    const tagsInput = (await ask(rl, color('标签 (用空格或逗号分隔，可空): ', C.cyan))).trim();
    const useEditor = args.editor;
    let content;
    if (useEditor) {
      rl.close();
      content = await editInEditor('');
    } else {
      content = await readMultiline(rl, '内容 (多行输入，单独一行输入 . 结束):');
    }
    const note = createNote(data, {
      title,
      content,
      tags: parseTags(tagsInput),
    });
    saveNotes(data);
    console.log(color(`已创建笔记 #${note.id}: ${note.title}`, C.green));
  } finally {
    if (!rl.closed) rl.close();
  }
}

function cmdList(args) {
  const data = loadNotes();
  let notes = data.notes;
  if (args.tag) notes = filterNotes(notes, { tag: args.tag });
  notes = sortNotes(notes);
  console.log();
  console.log(
    color(`  共 ${notes.length} 条笔记` + (args.tag ? ` (标签 #${args.tag})` : ''), C.bold)
  );
  console.log();
  renderTable(notes);
  console.log();
}

function cmdView(args) {
  const id = args._[0];
  if (!id) return console.log(color('用法: view <id>', C.yellow));
  const data = loadNotes();
  const n = findNote(data, id);
  if (!n) return console.log(color(`未找到笔记 #${id}`, C.red));
  renderNote(n);
}

async function cmdEdit(args) {
  const id = args._[0];
  if (!id) return console.log(color('用法: edit <id> [--editor]', C.yellow));
  const data = loadNotes();
  const n = findNote(data, id);
  if (!n) return console.log(color(`未找到笔记 #${id}`, C.red));

  const rl = createRL();
  try {
    const newTitle = (await ask(rl, color(`新标题 (回车保留 "${n.title}"): `, C.cyan))).trim();
    const newTags = (
      await ask(rl, color(`新标签 (回车保留 "${n.tags.join(',')}"，输入 - 清空): `, C.cyan))
    ).trim();

    let newContent;
    if (args.editor) {
      rl.close();
      newContent = await editInEditor(n.content);
    } else {
      const ans = (
        await ask(rl, color('修改内容? (e=外部编辑器 / r=重新输入 / 回车=保留): ', C.cyan))
      )
        .trim()
        .toLowerCase();
      if (ans === 'e') {
        rl.close();
        newContent = await editInEditor(n.content);
      } else if (ans === 'r') {
        newContent = await readMultiline(rl, '新内容 (单独一行 . 结束):');
      }
    }

    if (newTitle) n.title = newTitle;
    if (newTags === '-') n.tags = [];
    else if (newTags) n.tags = parseTags(newTags);
    if (typeof newContent === 'string') n.content = newContent;
    n.updatedAt = Date.now();

    saveNotes(data);
    console.log(color(`已更新笔记 #${n.id}`, C.green));
  } finally {
    if (!rl.closed) rl.close();
  }
}

async function cmdDelete(args) {
  const id = args._[0];
  if (!id) return console.log(color('用法: delete <id> [--yes]', C.yellow));
  const data = loadNotes();
  const n = findNote(data, id);
  if (!n) return console.log(color(`未找到笔记 #${id}`, C.red));

  if (!args.yes) {
    const rl = createRL();
    const ans = (await ask(rl, color(`确认删除 #${n.id} "${n.title}" ? (y/N) `, C.yellow)))
      .trim()
      .toLowerCase();
    rl.close();
    if (ans !== 'y' && ans !== 'yes') {
      console.log(color('已取消', C.gray));
      return;
    }
  }

  removeNote(data, id);
  saveNotes(data);
  console.log(color(`已删除笔记 #${id}`, C.green));
}

function cmdSearch(args) {
  const keyword = args._[0];
  if (!keyword) return console.log(color('用法: search <关键字> [--tag <tag>]', C.yellow));
  const data = loadNotes();
  let results = filterNotes(data.notes, { keyword, tag: args.tag });
  results = sortNotes(results);
  console.log();
  console.log(color(`  搜索 "${keyword}" 命中 ${results.length} 条`, C.bold));
  console.log();
  renderTable(results);
  console.log();
}

function cmdPin(args, pin) {
  const id = args._[0];
  if (!id) return console.log(color(`用法: ${pin ? 'pin' : 'unpin'} <id>`, C.yellow));
  const data = loadNotes();
  const n = findNote(data, id);
  if (!n) return console.log(color(`未找到笔记 #${id}`, C.red));
  n.pinned = pin;
  n.updatedAt = Date.now();
  saveNotes(data);
  console.log(color(`已${pin ? '置顶' : '取消置顶'}笔记 #${id}`, C.green));
}

function cmdTags() {
  const data = loadNotes();
  const counter = new Map();
  for (const n of data.notes) {
    for (const t of n.tags) counter.set(t, (counter.get(t) || 0) + 1);
  }
  if (counter.size === 0) {
    console.log(color('(没有任何标签)', C.gray));
    return;
  }
  const arr = [...counter.entries()].sort((a, b) => b[1] - a[1]);
  console.log();
  console.log(color(`  共 ${arr.length} 个标签`, C.bold));
  console.log();
  for (const [tag, count] of arr) {
    console.log(
      '  ' + color(('#' + tag).padEnd(20), C.magenta) + color(String(count) + ' 条', C.gray)
    );
  }
  console.log();
}

function cmdExport(args) {
  const out = args.out || path.join(process.cwd(), 'notes-export.md');
  const data = loadNotes();
  const notes = sortNotes(data.notes);
  const lines = [];
  lines.push(`# 笔记导出`);
  lines.push('');
  lines.push(`导出时间: ${formatDate(Date.now())}    共 ${notes.length} 条`);
  lines.push('');
  for (const n of notes) {
    lines.push(`## #${n.id} ${n.pinned ? '★ ' : ''}${n.title}`);
    lines.push('');
    lines.push(`*创建: ${formatDate(n.createdAt)}    更新: ${formatDate(n.updatedAt)}*`);
    if (n.tags.length > 0) {
      lines.push('');
      lines.push('标签: ' + n.tags.map((t) => '`#' + t + '`').join(' '));
    }
    lines.push('');
    lines.push(n.content || '_(空内容)_');
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  fs.writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(color(`已导出 ${notes.length} 条笔记到: ${out}`, C.green));
}

function cmdStats() {
  const data = loadNotes();
  const total = data.notes.length;
  const pinned = data.notes.filter((n) => n.pinned).length;
  const totalChars = data.notes.reduce((s, n) => s + (n.content ? n.content.length : 0), 0);
  const tagSet = new Set();
  for (const n of data.notes) for (const t of n.tags) tagSet.add(t);
  const file = fs.existsSync(NOTES_FILE) ? fs.statSync(NOTES_FILE).size : 0;
  console.log();
  console.log(color('  统计信息', C.bold));
  console.log(color('  ' + '─'.repeat(30), C.gray));
  console.log(`  笔记总数: ${color(total, C.cyan)}`);
  console.log(`  置顶笔记: ${color(pinned, C.yellow)}`);
  console.log(`  内容字数: ${color(totalChars, C.cyan)}`);
  console.log(`  标签数量: ${color(tagSet.size, C.magenta)}`);
  console.log(`  存储大小: ${color(file + ' B', C.gray)}`);
  console.log(`  数据位置: ${color(NOTES_FILE, C.gray)}`);
  console.log();
}

// ─── 交互式 REPL ──────────────────────────────────────────────

async function runREPL() {
  console.log(color('\n  CLI 记事本  - 输入 help 查看命令，exit 退出\n', C.bold + C.cyan));
  const rl = createRL();
  rl.setPrompt(color('note> ', C.green));
  rl.prompt();

  rl.on('line', async (raw) => {
    const line = raw.trim();
    if (!line) return rl.prompt();
    rl.pause();
    try {
      const parts = tokenize(line);
      const cmd = parts.shift();
      const args = parseArgs(parts);
      if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
        rl.close();
        return;
      }
      await dispatch(cmd, args);
    } catch (e) {
      console.log(color('命令出错: ' + e.message, C.red));
    }
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(color('\n  再见！', C.gray));
    process.exit(0);
  });
}

// 简易命令行参数分词，支持引号
function tokenize(line) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// 解析 --key value 与 --flag 形式
function parseArgs(parts) {
  const args = { _: [] };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('--')) {
      const key = p.slice(2);
      const next = parts[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(p);
    }
  }
  return args;
}

// ─── 命令分发 ──────────────────────────────────────────────

async function dispatch(cmd, args) {
  switch (cmd) {
    case 'add':
    case 'new':
      return await cmdAdd(args);
    case 'list':
    case 'ls':
      return cmdList(args);
    case 'view':
    case 'show':
    case 'cat':
      return cmdView(args);
    case 'edit':
      return await cmdEdit(args);
    case 'delete':
    case 'del':
    case 'rm':
      return await cmdDelete(args);
    case 'search':
    case 'find':
      return cmdSearch(args);
    case 'pin':
      return cmdPin(args, true);
    case 'unpin':
      return cmdPin(args, false);
    case 'tags':
      return cmdTags();
    case 'export':
      return cmdExport(args);
    case 'stats':
      return cmdStats();
    case 'help':
    case '?':
      return printHelp();
    default:
      console.log(color(`未知命令: ${cmd} (输入 help 查看)`, C.red));
  }
}

function printHelp() {
  console.log(`
${color('  CLI 记事本工具', C.bold + C.cyan)}

  ${color('用法:', C.bold)} node notepad.js [command] [options]
        或进入交互模式: node notepad.js

  ${color('命令:', C.bold)}
    ${color('add', C.green)}                  新建笔记 (交互式)
        --editor              使用 $EDITOR 编辑器输入内容
    ${color('list', C.green)}                  列出所有笔记
        --tag <tag>           按标签筛选
    ${color('view', C.green)} <id>             查看指定笔记
    ${color('edit', C.green)} <id> [--editor]  编辑笔记
    ${color('delete', C.green)} <id> [--yes]     删除笔记
    ${color('search', C.green)} <关键字>          搜索标题/内容/标签
        --tag <tag>           额外按标签过滤
    ${color('pin', C.green)} <id>             置顶笔记
    ${color('unpin', C.green)} <id>             取消置顶
    ${color('tags', C.green)}                  列出所有标签
    ${color('export', C.green)} [--out <file>]   导出为 Markdown
    ${color('stats', C.green)}                  显示统计信息
    ${color('help', C.green)}                  查看帮助
    ${color('exit', C.green)}                  退出交互模式

  ${color('数据位置:', C.bold)} ${NOTES_FILE}
`);
}

// ─── 入口 ──────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    await runREPL();
    return;
  }
  const cmd = argv.shift();
  const args = parseArgs(argv);
  try {
    await dispatch(cmd, args);
  } catch (e) {
    console.error(color('执行出错: ' + e.message, C.red));
    process.exit(1);
  }
}

main();
