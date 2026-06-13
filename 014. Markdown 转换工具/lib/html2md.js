/**
 * HTML 转 Markdown 转换器
 * 纯 Node.js 实现，不依赖第三方库
 *
 * 支持的 HTML 标签：
 *   - h1 ~ h6 → # ~ ######
 *   - p → 段落
 *   - strong / b → **text**
 *   - em / i → *text*
 *   - del / s / strike → ~~text~~
 *   - code → `code`
 *   - pre → 代码块
 *   - a → [text](href)
 *   - img → ![alt](src)
 *   - ul / ol / li → 列表
 *   - blockquote → > 引用
 *   - hr → ---
 *   - table / thead / tbody / tr / th / td → 表格
 *   - br → 换行
 */

"use strict";

// ============================================================
// 简易 DOM 树构建
// ============================================================

function createNode(type, tag, attrs, content) {
  return {
    type,
    tag: tag || "",
    attrs: attrs || {},
    children: [],
    content: content || "",
  };
}

/**
 * 将 HTML 字符串解析为 DOM 树
 */
function parseHtml(html) {
  const root = createNode("root", "", {});
  const stack = [root];
  const regex = /<(\/?)(\w[\w-]*)\s*([^>]*?)(\/?)>|([^<]+)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const parent = stack[stack.length - 1];

    if (match[5] !== undefined) {
      // 文本节点
      const text = match[5];
      if (text) {
        parent.children.push(createNode("text", "", {}, text));
      }
    } else {
      const isClosing = match[1] === "/";
      const tag = match[2].toLowerCase();
      const attrs = parseAttrs(match[3]);
      const isSelfClosing = match[4] === "/";

      if (isClosing) {
        // 找到匹配的 open tag 并弹出
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === tag) {
            stack.length = i;
            break;
          }
        }
      } else {
        const node = createNode("element", tag, attrs);
        parent.children.push(node);
        if (!isSelfClosing && !VOID_TAGS.has(tag)) {
          stack.push(node);
        }
      }
    }
  }

  return root;
}

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

function parseAttrs(attrStr) {
  const attrs = {};
  const regex = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  while ((match = regex.exec(attrStr))) {
    attrs[match[1].toLowerCase()] = match[2] || match[3] || match[4] || "";
  }
  return attrs;
}

// ============================================================
// 解码 HTML 实体
// ============================================================

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// ============================================================
// 渲染节点为 Markdown（递归）
// ============================================================

function renderNode(node, listDepth) {
  if (node.type === "text") {
    return decodeHtmlEntities(node.content);
  }

  const tag = node.tag;
  const childrenMd = renderChildren(node.children, tag, listDepth);

  switch (tag) {
    // 标题
    case "h1":
      return `\n\n# ${childrenMd.trim()}\n\n`;
    case "h2":
      return `\n\n## ${childrenMd.trim()}\n\n`;
    case "h3":
      return `\n\n### ${childrenMd.trim()}\n\n`;
    case "h4":
      return `\n\n#### ${childrenMd.trim()}\n\n`;
    case "h5":
      return `\n\n##### ${childrenMd.trim()}\n\n`;
    case "h6":
      return `\n\n###### ${childrenMd.trim()}\n\n`;

    // 段落
    case "p":
      return `\n\n${childrenMd.trim()}\n\n`;

    // 粗体
    case "strong":
    case "b":
      return `**${childrenMd}**`;

    // 斜体
    case "em":
    case "i":
      return `*${childrenMd}*`;

    // 删除线
    case "del":
    case "s":
    case "strike":
      return `~~${childrenMd}~~`;

    // 行内代码
    case "code":
      return `\`${childrenMd}\``;

    // 代码块
    case "pre": {
      // 提取代码内容，可能包含 <code> 标签
      let codeContent = "";
      let lang = "";
      for (const child of node.children) {
        if (child.tag === "code") {
          // 从 class="language-xxx" 提取语言
          const codeClass = child.attrs.class || "";
          const langMatch = codeClass.match(/language-(\w+)/);
          if (langMatch) lang = langMatch[1];
          codeContent = renderTextOnly(child);
        } else if (child.type === "text") {
          codeContent += decodeHtmlEntities(child.content);
        }
      }
      if (!codeContent) codeContent = renderTextOnly(node);
      return `\n\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n\n`;
    }

    // 链接
    case "a":
      return `[${childrenMd}](${node.attrs.href || ""})`;

    // 图片
    case "img":
      return `![${decodeHtmlEntities(node.attrs.alt || "")}](${node.attrs.src || ""})`;

    // 无序列表
    case "ul":
      return `\n${childrenMd}\n`;

    // 有序列表
    case "ol":
      return `\n${childrenMd}\n`;

    // 列表项
    case "li": {
      const indent = "  ".repeat(Math.max(0, listDepth));
      return `${indent}- ${childrenMd.trim()}\n`;
    }

    // 引用
    case "blockquote": {
      const lines = childrenMd.trim().split("\n");
      return "\n" + lines.map((l) => `> ${l}`).join("\n") + "\n\n";
    }

    // 水平线
    case "hr":
      return "\n\n---\n\n";

    // 换行
    case "br":
      return "\n";

    // 表格
    case "table":
      return renderTable(node);

    // 忽略的标签（head, style, script, meta 等）
    case "head":
    case "style":
    case "script":
    case "meta":
    case "title":
      return "";

    // 默认：只渲染子内容
    default:
      return childrenMd;
  }
}

function renderChildren(children, parentTag, listDepth) {
  if (parentTag === "ol") {
    let liIndex = 0;
    return children
      .map((child) => {
        if (child.tag === "li") {
          liIndex++;
          const indent = "  ".repeat(Math.max(0, listDepth));
          const liContent = renderChildren(
            child.children,
            "li",
            listDepth + 1,
          ).trim();
          return `${indent}${liIndex}. ${liContent}\n`;
        }
        return renderNode(child, listDepth);
      })
      .join("");
  }

  return children.map((child) => renderNode(child, listDepth)).join("");
}

/**
 * 仅提取纯文本内容（用于代码块等）
 */
function renderTextOnly(node) {
  if (node.type === "text") return decodeHtmlEntities(node.content);
  return node.children.map((c) => renderTextOnly(c)).join("");
}

// ============================================================
// 表格渲染
// ============================================================

function renderTable(tableNode) {
  const rows = [];

  function collectRows(node) {
    if (node.tag === "tr") {
      const cells = [];
      for (const child of node.children) {
        if (child.tag === "th" || child.tag === "td") {
          cells.push(renderChildren(child.children, child.tag, 0).trim());
        }
      }
      rows.push(cells);
    } else {
      for (const child of node.children) {
        if (child.type === "element") collectRows(child);
      }
    }
  }

  collectRows(tableNode);

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  let md = "\n";

  // 表头
  const header = rows[0];
  while (header.length < colCount) header.push("");
  md += "| " + header.join(" | ") + " |\n";
  md += "| " + header.map(() => "---").join(" | ") + " |\n";

  // 数据行
  for (let i = 1; i < rows.length; i++) {
    while (rows[i].length < colCount) rows[i].push("");
    md += "| " + rows[i].join(" | ") + " |\n";
  }

  return md + "\n";
}

// ============================================================
// 主转换函数
// ============================================================

function convert(html) {
  if (!html || typeof html !== "string") return "";

  const tree = parseHtml(html);
  let md = "";

  for (const child of tree.children) {
    md += renderNode(child, 0);
  }

  // 清理多余空行和空格
  return md
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+$/gm, "")
    .trim();
}

// ============================================================
// 导出
// ============================================================

module.exports = { convert };
