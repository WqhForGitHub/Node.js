# CLI 记事本工具

纯 Node.js 实现的命令行记事本，无任何第三方依赖。支持笔记的增删改查、标签、置顶、搜索、Markdown 导出，并提供交互式 REPL 模式。

## 运行

```bash
# 进入交互模式
node notepad.js

# 直接执行子命令
node notepad.js list
node notepad.js add
node notepad.js view 1
```

## 命令一览

| 命令                      | 说明                                            |
| ------------------------- | ----------------------------------------------- |
| `add` / `new`             | 新建笔记（可加 `--editor` 调用系统编辑器）      |
| `list` / `ls`             | 列出全部笔记，置顶优先；支持 `--tag <tag>` 过滤 |
| `view <id>`               | 查看指定笔记                                    |
| `edit <id>`               | 编辑笔记，可加 `--editor`                       |
| `delete <id>`             | 删除笔记，可加 `--yes` 跳过确认                 |
| `search <关键字>`         | 搜索标题/内容/标签，可叠加 `--tag`              |
| `pin <id>` / `unpin <id>` | 置顶 / 取消置顶                                 |
| `tags`                    | 统计所有标签                                    |
| `export [--out <file>]`   | 导出为 Markdown（默认 `notes-export.md`）       |
| `stats`                   | 显示统计信息                                    |
| `help`                    | 查看帮助                                        |
| `exit` / `quit` / `q`     | 退出 REPL                                       |

## 输入说明

- **多行内容输入**：在新建/编辑时单独一行输入 `.` 结束输入。
- **外部编辑器**：附加 `--editor`，将启动 `$EDITOR`（Windows 默认为 `notepad`，Unix 默认为 `vi`）。
- **标签格式**：以空格或逗号分隔，例如 `工作 学习,想法`；编辑时输入 `-` 可清空标签。

## 数据存储

- 笔记文件：`./data/notes.json`
- 编辑器临时文件：`./data/tmp/`
- 写入采用 `tmp + rename` 原子替换，避免崩溃损坏数据。

## 示例

```bash
# 交互式新建笔记
node notepad.js add

# 列出标签 "工作" 下的笔记
node notepad.js list --tag 工作

# 搜索包含 "bug" 的笔记
node notepad.js search bug

# 置顶笔记 3
node notepad.js pin 3

# 导出全部为 Markdown
node notepad.js export --out my-notes.md
```
