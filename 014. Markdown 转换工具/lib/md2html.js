/**
 * Markdown 转 HTML 转换器
 * 纯 Node.js 实现，不依赖第三方库
 *
 * 支持的语法：
 *   - 标题 (# ~ ######)
 *   - 段落
 *   - 粗体 (**text** / __text__)
 *   - 斜体 (*text* / _text_)
 *   - 删除线 (~~text~~)
 *   - 行内代码 (`code`)
 *   - 代码块 (```lang ... ```)
 *   - 无序列表 (- / * / +)
 *   - 有序列表 (1. 2. 3.)
 *   - 链接 [text](url)
 *   - 图片 ![alt](url)
 *   - 引用 (> text)
 *   - 水平线 (--- / *** / ___)
 *   - 表格
 *   - HTML 标签（原样保留）
 */

'use strict';

// ============================================================
// 工具函数
// ============================================================

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 内联元素解析
// ============================================================

function parseInline(text) {
  // 行内代码（优先处理，内部不做进一步解析）
  text = text.replace(/`(.+?)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 图片（在链接之前处理）
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // 链接
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 粗体 + 斜体 (***text***)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // 粗体
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // 斜体
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');

  // 删除线
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

  return text;
}

// ============================================================
// 块级元素解析
// ============================================================

/**
 * 解析表格
 */
function parseTable(lines) {
  if (lines.length < 2) return null;

  // 解析表头
  const headerLine = lines[0].trim();
  const separatorLine = lines[1].trim();

  // 验证分隔行格式 (如 | --- | --- |)
  if (!/^\|?\s*[-:]+[-|\s:]*\|?\s*$/.test(separatorLine)) return null;

  const parseRow = (line) => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  };

  const headers = parseRow(headerLine);
  const aligns = parseRow(separatorLine).map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    if (cell.startsWith(':')) return 'left';
    return '';
  });

  let html = '<table>\n<thead>\n<tr>\n';
  headers.forEach((h, i) => {
    const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
    html += `<th${align}>${parseInline(h)}</th>\n`;
  });
  html += '</tr>\n</thead>\n';

  if (lines.length > 2) {
    html += '<tbody>\n';
    for (let i = 2; i < lines.length; i++) {
      const cells = parseRow(lines[i].trim());
      html += '<tr>\n';
      cells.forEach((c, ci) => {
        const align = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : '';
        html += `<td${align}>${parseInline(c)}</td>\n`;
      });
      html += '</tr>\n';
    }
    html += '</tbody>\n';
  }

  html += '</table>';
  return html;
}

/**
 * 解析代码块
 */
function parseCodeBlock(lines, lang) {
  const code = lines.map((l) => escapeHtml(l)).join('\n');
  const langAttr = lang ? ` class="language-${lang}"` : '';
  return `<pre><code${langAttr}>${code}</code></pre>`;
}

/**
 * 解析引用块
 */
function parseBlockquote(lines) {
  const content = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
  const inner = convert(content);
  return `<blockquote>\n${inner}\n</blockquote>`;
}

/**
 * 解析无序列表
 */
function parseUnorderedList(lines) {
  const items = lines.map((l) => {
    const text = l.replace(/^\s*[-*+]\s+/, '');
    return `<li>${parseInline(text)}</li>`;
  });
  return `<ul>\n${items.join('\n')}\n</ul>`;
}

/**
 * 解析有序列表
 */
function parseOrderedList(lines) {
  const items = lines.map((l) => {
    const text = l.replace(/^\s*\d+\.\s+/, '');
    return `<li>${parseInline(text)}</li>`;
  });
  return `<ol>\n${items.join('\n')}\n</ol>`;
}

// ============================================================
// 主转换函数
// ============================================================

function convert(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  const lines = markdown.split('\n');
  const htmlParts = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行
    if (trimmed === '') {
      i++;
      continue;
    }

    // 代码块
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      htmlParts.push(parseCodeBlock(codeLines, lang));
      i++; // 跳过结束的 ```
      continue;
    }

    // 水平线
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      htmlParts.push('<hr>');
      i++;
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = parseInline(headingMatch[2]);
      htmlParts.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // 表格
    if (
      i + 1 < lines.length &&
      /^\|.*\|$/.test(trimmed) &&
      /^\|?\s*[-:]+/.test(lines[i + 1].trim())
    ) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableHtml = parseTable(tableLines);
      if (tableHtml) {
        htmlParts.push(tableHtml);
        continue;
      }
      // 如果不是有效表格，回退
      i -= tableLines.length;
    }

    // 引用块
    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i]);
        i++;
      }
      htmlParts.push(parseBlockquote(quoteLines));
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(trimmed)) {
      const listLines = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i].trim())) {
        listLines.push(lines[i]);
        i++;
      }
      htmlParts.push(parseUnorderedList(listLines));
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(trimmed)) {
      const listLines = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i].trim())) {
        listLines.push(lines[i]);
        i++;
      }
      htmlParts.push(parseOrderedList(listLines));
      continue;
    }

    // 普通段落
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*+]\s+/.test(lines[i].trim()) &&
      !/^\s*\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*_]{3,}\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      htmlParts.push(`<p>${parseInline(paraLines.join('\n'))}</p>`);
    }
  }

  return htmlParts.join('\n\n');
}

// ============================================================
// 带完整 HTML 文档包装的转换
// ============================================================

function convertToFullHtml(markdown, options = {}) {
  const title = options.title || 'Markdown Document';
  const css =
    options.css ||
    `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 16px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
    }
    th {
      background: #f4f4f4;
    }
    img {
      max-width: 100%;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 24px 0;
    }
  `;

  const body = convert(markdown);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ============================================================
// 导出
// ============================================================

module.exports = { convert, convertToFullHtml, parseInline };
