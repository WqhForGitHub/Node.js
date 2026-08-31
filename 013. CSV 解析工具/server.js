const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3013;
const DATA_DIR = path.join(__dirname, 'data');

// ============================================================
// 1. 确保数据目录存在 & 创建示例文件
// ============================================================
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** 创建示例 CSV 文件 */
function createSampleFiles() {
  // 示例 1: 员工信息表（标准逗号分隔）
  const employees = path.join(DATA_DIR, '员工信息.csv');
  if (!fs.existsSync(employees)) {
    fs.writeFileSync(
      employees,
      `\ufeff姓名,部门,职位,薪资,入职日期,邮箱
张三,技术部,高级工程师,25000,2020-03-15,zhangsan@example.com
李四,市场部,市场经理,22000,2019-07-20,lisi@example.com
王五,技术部,前端工程师,18000,2021-01-10,wangwu@example.com
赵六,人事部,HR专员,15000,2022-05-08,zhaoliu@example.com
孙七,技术部,后端工程师,20000,2020-11-22,sunqi@example.com
周八,财务部,财务主管,23000,2018-09-01,zhouba@example.com
吴九,市场部,品牌策划,17000,2021-06-15,wujiu@example.com
郑十,技术部,架构师,35000,2017-04-20,zhengshi@example.com
陈一一,运营部,运营专员,14000,2022-12-01,chenyy@example.com
林二二,技术部,测试工程师,16000,2021-08-10,liner@example.com`,
      'utf-8'
    );
  }

  // 示例 2: 商品销售表（含引号字段、逗号在字段内）
  const sales = path.join(DATA_DIR, '商品销售.csv');
  if (!fs.existsSync(sales)) {
    fs.writeFileSync(
      sales,
      `商品名称,分类,单价,销量,总金额,备注
"无线蓝牙耳机","电子产品",299.00,1500,448500.00,"热销商品,库存充足"
"纯棉T恤","服装",89.90,2300,206770.00,"夏季爆款"
"不锈钢保温杯","家居",128.00,800,102400.00,"304不锈钢,500ml容量"
"有机绿茶","食品",68.50,3200,219200.00,"2024年春茶,明前采摘"
"智能手表","电子产品",599.00,600,359400.00,"支持心率监测,GPS定位"
"真皮钱包","配饰",399.00,400,159600.00,"头层牛皮,手工制作"
"瑜伽垫","运动",79.00,1800,142200.00,"6mm加厚,防滑设计"
"进口巧克力","食品",45.80,2500,114500.00,"比利时进口,纯可可脂"`,
      'utf-8'
    );
  }

  // 示例 3: 学生成绩表（分号分隔）
  const scores = path.join(DATA_DIR, '学生成绩.csv');
  if (!fs.existsSync(scores)) {
    fs.writeFileSync(
      scores,
      `学号;姓名;语文;数学;英语;物理;化学;总分
20240001;刘明;92;98;88;95;90;463
20240002;陈静;95;85;96;82;88;446
20240003;王强;78;99;72;98;95;442
20240004;李华;88;76;91;75;82;412
20240005;张丽;96;92;94;88;85;455
20240006;赵鹏;82;88;79;92;96;437
20240007;黄芳;90;72;98;68;76;404
20240008;周杰;75;96;65;99;98;433
20240009;吴敏;98;90;92;85;80;445
20240010;孙磊;80;94;76;93;92;435`,
      'utf-8'
    );
  }

  // 示例 4: 服务器日志（Tab 分隔）
  const logs = path.join(DATA_DIR, '服务器日志.csv');
  if (!fs.existsSync(logs)) {
    const lines = ['时间\t级别\t来源\t状态码\t耗时(ms)\t详情'];
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const sources = [
      'api-gateway',
      'auth-service',
      'user-service',
      'order-service',
      'payment-service',
    ];
    const statuses = [200, 201, 301, 400, 401, 403, 404, 500, 502, 503];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - (30 - i) * 3600000);
      const level = levels[i % levels.length];
      const source = sources[i % sources.length];
      const status = statuses[i % statuses.length];
      const duration = Math.floor(Math.random() * 500) + 10;
      const detail =
        status >= 500
          ? `Connection timeout after ${duration}ms`
          : status >= 400
            ? `Invalid request parameter`
            : `Request processed successfully`;
      lines.push(`${d.toISOString()}\t${level}\t${source}\t${status}\t${duration}\t${detail}`);
    }
    fs.writeFileSync(logs, lines.join('\n'), 'utf-8');
  }

  // 示例 5: 含转义引号的 CSV
  const quotes = path.join(DATA_DIR, '书籍清单.csv');
  if (!fs.existsSync(quotes)) {
    fs.writeFileSync(
      quotes,
      `书名,作者,出版社,价格,简介
"JavaScript高级程序设计","Matt Frisbie","人民邮电出版社",129.00,"被称为""红宝书"",前端开发必读经典"
"深入理解计算机系统","Randal E. Bryant","机械工业出版社",139.00,"CSAPP,程序员必读""圣经"""
"算法导论","Thomas H. Cormen","MIT Press",128.00,"涵盖""排序、图论、动态规划""等核心算法"
"设计模式","Erich Gamma","机械工业出版社",79.00,"GoF经典之作,""模式""入门首选"
"代码大全","Steve McConnell","电子工业出版社",118.00,"软件构建的""百科全书"",实用指南"`,
      'utf-8'
    );
  }
}

createSampleFiles();

// ============================================================
// 2. CSV 解析器核心
// ============================================================

/**
 * CSV 解析器 - 纯 Node.js 实现
 * 支持：自定义分隔符、引号字段、转义引号、BOM 头、自动检测分隔符
 */
class CSVParser {
  /**
   * @param {object} [options]
   * @param {string}  [options.delimiter=',']  - 字段分隔符
   * @param {string}  [options.quote='"']      - 引用字符
   * @param {boolean} [options.escape=true]    - 是否处理引号转义（双引号转义）
   * @param {boolean} [options.header=true]    - 首行是否为表头
   * @param {boolean} [options.skipEmpty=true] - 是否跳过空行
   * @param {boolean} [options.trim=true]      - 是否去除字段首尾空白
   * @param {boolean} [options.bom=true]       - 是否处理 BOM 头
   */
  constructor(options = {}) {
    this.delimiter = options.delimiter || ',';
    this.quote = options.quote || '"';
    this.escape = options.escape !== false;
    this.header = options.header !== false;
    this.skipEmpty = options.skipEmpty !== false;
    this.trim = options.trim !== false;
    this.bom = options.bom !== false;
  }

  /**
   * 解析 CSV 字符串
   * @param {string} input - CSV 文本内容
   * @returns {{ headers: string[], rows: object[], rawRows: string[][] }}
   */
  parse(input) {
    // 处理 BOM
    if (this.bom && input.charCodeAt(0) === 0xfeff) {
      input = input.slice(1);
    }

    const rawRows = this._parseRows(input);

    if (rawRows.length === 0) {
      return { headers: [], rows: [], rawRows: [] };
    }

    let headers = [];
    let dataStartIdx = 0;

    if (this.header) {
      headers = rawRows[0];
      dataStartIdx = 1;
    }

    // 转为对象数组
    const rows = [];
    for (let i = dataStartIdx; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j] || `column_${j}`;
        obj[key] = j < raw.length ? raw[j] : '';
      }
      rows.push(obj);
    }

    return { headers, rows, rawRows };
  }

  /**
   * 逐行解析 CSV
   * @param {string} input
   * @returns {string[][]}
   */
  _parseRows(input) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < input.length) {
      const ch = input[i];

      if (inQuotes) {
        if (ch === this.quote) {
          // 检查是否为转义引号（双引号）
          if (this.escape && i + 1 < input.length && input[i + 1] === this.quote) {
            field += this.quote;
            i += 2;
            continue;
          }
          // 引号结束
          inQuotes = false;
          i++;
          continue;
        }
        // 引号内普通字符
        field += ch;
        i++;
      } else {
        if (ch === this.quote && field === '') {
          // 进入引号模式（只在字段开头才视为引号开始）
          inQuotes = true;
          i++;
        } else if (ch === this.delimiter) {
          row.push(this.trim ? field.trim() : field);
          field = '';
          i++;
        } else if (ch === '\r') {
          // 处理 \r\n 或单独 \r
          row.push(this.trim ? field.trim() : field);
          field = '';
          if (i + 1 < input.length && input[i + 1] === '\n') {
            i += 2;
          } else {
            i++;
          }
          if (!this.skipEmpty || row.some((f) => f !== '')) {
            rows.push(row);
          }
          row = [];
        } else if (ch === '\n') {
          row.push(this.trim ? field.trim() : field);
          field = '';
          i++;
          if (!this.skipEmpty || row.some((f) => f !== '')) {
            rows.push(row);
          }
          row = [];
        } else {
          field += ch;
          i++;
        }
      }
    }

    // 处理最后一行
    if (field !== '' || row.length > 0) {
      row.push(this.trim ? field.trim() : field);
      if (!this.skipEmpty || row.some((f) => f !== '')) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * 自动检测分隔符
   * @param {string} input - CSV 文本前几行
   * @returns {string} 检测到的分隔符
   */
  static detectDelimiter(input) {
    // 处理 BOM
    if (input.charCodeAt(0) === 0xfeff) {
      input = input.slice(1);
    }

    // 取前几行（跳过引号内的分隔符）
    const firstLines = input.split(/\r?\n/).slice(0, 5);
    const candidates = [',', '\t', ';', '|'];
    const scores = {};

    for (const sep of candidates) {
      scores[sep] = 0;
      let consistent = true;
      let prevCount = -1;

      for (const line of firstLines) {
        if (!line.trim()) continue;
        const count = countOutsideQuotes(line, sep);
        if (count === 0) {
          consistent = false;
          continue;
        }
        if (prevCount === -1) {
          prevCount = count;
        } else if (count !== prevCount) {
          consistent = false;
        }
        scores[sep] += count * (consistent ? 2 : 1);
      }
    }

    let best = ',';
    let bestScore = 0;
    for (const [sep, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = sep;
      }
    }
    return best;
  }
}

/**
 * 统计引号外的分隔符出现次数
 */
function countOutsideQuotes(line, sep) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && line[i] === sep) {
      count++;
    }
  }
  return count;
}

// ============================================================
// 3. CSV 序列化器（将数据导出为 CSV）
// ============================================================

/**
 * 将数据序列化为 CSV 字符串
 * @param {string[]} headers - 表头
 * @param {object[]} rows - 数据行
 * @param {object} [options]
 * @param {string}  [options.delimiter=','] - 分隔符
 * @param {string}  [options.quote='"']     - 引用字符
 * @param {boolean} [options.bom=true]      - 是否添加 BOM
 * @returns {string}
 */
function serializeCSV(headers, rows, options = {}) {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const addBom = options.bom !== false;

  function escapeField(field) {
    const str = String(field ?? '');
    const needsQuote =
      str.includes(delimiter) || str.includes(quote) || str.includes('\n') || str.includes('\r');
    if (!needsQuote) return str;
    return quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote;
  }

  const lines = [];
  lines.push(headers.map(escapeField).join(delimiter));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(delimiter));
  }

  const csv = lines.join('\n');
  return addBom ? '\ufeff' + csv : csv;
}

// ============================================================
// 4. 工具函数
// ============================================================

/** 发送 JSON 响应 */
function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

/** 发送 HTML 响应 */
function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** 读取请求体 */
function readBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('请求体过大'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 安全拼接路径 */
function safePath(base, relative) {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

/** 判断是否为数字字符串 */
function isNumeric(val) {
  if (val === '' || val === null || val === undefined) return false;
  return !isNaN(val) && !isNaN(parseFloat(val));
}

/** 计算列统计信息 */
function columnStats(values) {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  const numericVals = nonEmpty.filter(isNumeric).map(Number);

  const stats = {
    total: values.length,
    nonEmpty: nonEmpty.length,
    empty: values.length - nonEmpty.length,
    unique: new Set(nonEmpty).size,
  };

  if (numericVals.length > nonEmpty.length * 0.5 && numericVals.length > 0) {
    // 超过一半是数字，视为数值列
    stats.type = 'number';
    stats.min = Math.min(...numericVals);
    stats.max = Math.max(...numericVals);
    stats.sum = numericVals.reduce((a, b) => a + b, 0);
    stats.avg = +(stats.sum / numericVals.length).toFixed(2);
  } else {
    // 文本列
    stats.type = 'text';
    const freq = {};
    for (const v of nonEmpty) {
      freq[v] = (freq[v] || 0) + 1;
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    stats.topValues = sorted.slice(0, 5).map(([val, count]) => ({ val, count }));
  }

  return stats;
}

/** 解析 multipart/form-data 上传（简易实现） */
function parseMultipart(body, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = body.indexOf(boundaryBuf) + boundaryBuf.length;

  while (start < body.length) {
    // 跳过 \r\n
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

    // 找下一个 boundary
    const nextBoundary = body.indexOf(boundaryBuf, start);
    if (nextBoundary === -1) break;

    const partData = body.slice(start, nextBoundary - 2); // 减去 \r\n
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const headerStr = partData.slice(0, headerEnd).toString('utf-8');
    const content = partData.slice(headerEnd + 4);

    // 解析 Content-Disposition
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : null,
      content,
    });

    start = nextBoundary + boundaryBuf.length;
  }

  return parts;
}

// ============================================================
// 5. 存储已解析的 CSV 数据（内存）
// ============================================================

/** @type {Map<string, {headers: string[], rows: object[], rawRows: string[][], delimiter: string, filename: string, uploadedAt: string}>} */
const csvStore = new Map();
let fileIdCounter = 0;

/** 加载示例文件到存储 */
function loadSampleFiles() {
  const files = [
    { name: '员工信息.csv', delimiter: ',' },
    { name: '商品销售.csv', delimiter: ',' },
    { name: '学生成绩.csv', delimiter: ';' },
    { name: '服务器日志.csv', delimiter: '\t' },
    { name: '书籍清单.csv', delimiter: ',' },
  ];

  for (const f of files) {
    const filePath = path.join(DATA_DIR, f.name);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new CSVParser({ delimiter: f.delimiter });
    const result = parser.parse(content);

    const id = String(++fileIdCounter);
    csvStore.set(id, {
      id,
      headers: result.headers,
      rows: result.rows,
      rawRows: result.rawRows,
      delimiter: f.delimiter,
      filename: f.name,
      uploadedAt: new Date().toISOString(),
    });
  }
}

loadSampleFiles();

// ============================================================
// 6. 路由处理器
// ============================================================

/** GET / — 主页面 */
function handleIndex(req, res) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSV 解析工具</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fa; color: #333; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; margin: 20px 0; font-size: 28px; color: #2c3e50; }
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .card h2 { font-size: 18px; color: #2c3e50; margin-bottom: 16px; }

    /* 文件列表 */
    .file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .file-card { padding: 14px 16px; border: 2px solid #ecf0f1; border-radius: 10px; cursor: pointer; transition: all .15s; }
    .file-card:hover { border-color: #3498db; background: #f0f8ff; }
    .file-card.active { border-color: #3498db; background: #e8f4fd; }
    .file-card-name { font-weight: 600; color: #2c3e50; margin-bottom: 4px; font-size: 14px; }
    .file-card-meta { font-size: 12px; color: #95a5a6; }

    /* 上传区 */
    .upload-zone { border: 2px dashed #bdc3c7; border-radius: 10px; padding: 30px; text-align: center; transition: all .2s; cursor: pointer; }
    .upload-zone:hover, .upload-zone.dragover { border-color: #3498db; background: #f0f8ff; }
    .upload-zone input { display: none; }
    .upload-icon { font-size: 36px; margin-bottom: 8px; }
    .upload-text { color: #7f8c8d; font-size: 14px; }

    /* 手动输入 */
    .csv-input { width: 100%; min-height: 120px; border: 1px solid #ddd; border-radius: 8px; padding: 12px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; resize: vertical; }
    .csv-input:focus { outline: none; border-color: #3498db; }

    /* 工具栏 */
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .toolbar input, .toolbar select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
    .toolbar input:focus, .toolbar select:focus { outline: none; border-color: #3498db; }

    /* 按钮 */
    .btn { padding: 6px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all .15s; display: inline-flex; align-items: center; gap: 4px; }
    .btn-primary { background: #3498db; color: #fff; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: #fff; }
    .btn-success:hover { background: #219a52; }
    .btn-warning { background: #f39c12; color: #fff; }
    .btn-warning:hover { background: #d68910; }
    .btn-danger { background: #e74c3c; color: #fff; }
    .btn-danger:hover { background: #c0392b; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }

    /* 数据表格 */
    .table-wrap { overflow-x: auto; max-height: 500px; overflow-y: auto; border: 1px solid #ecf0f1; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { position: sticky; top: 0; z-index: 1; }
    th { background: #2c3e50; color: #fff; padding: 10px 14px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; }
    th:hover { background: #34495e; }
    th .sort-icon { margin-left: 4px; font-size: 10px; opacity: .5; }
    th.sorted .sort-icon { opacity: 1; }
    td { padding: 8px 14px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
    tr:hover td { background: #f8f9fa; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }

    /* 统计面板 */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .stat-card { padding: 14px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ecf0f1; }
    .stat-card-header { font-weight: 600; color: #2c3e50; margin-bottom: 8px; font-size: 14px; }
    .stat-card-body { font-size: 12px; color: #555; line-height: 1.8; }
    .stat-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; }
    .stat-badge.num { background: #e8f8f5; color: #27ae60; }
    .stat-badge.text { background: #fef9e7; color: #f39c12; }

    /* 分页 */
    .pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 16px; }
    .page-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; background: #fff; transition: all .15s; }
    .page-btn:hover { border-color: #3498db; color: #3498db; }
    .page-btn.active { background: #3498db; color: #fff; border-color: #3498db; }
    .page-btn:disabled { opacity: .4; cursor: not-allowed; }
    .page-info { font-size: 13px; color: #7f8c8d; margin: 0 8px; }

    /* Toast */
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; z-index: 999; opacity: 0; transition: opacity .3s; }
    .toast.show { opacity: 1; }
    .toast.success { background: #27ae60; }
    .toast.error { background: #e74c3c; }

    /* 空状态 */
    .empty { text-align: center; color: #bdc3c7; padding: 40px 0; font-size: 15px; }

    /* 标签页 */
    .tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid #ecf0f1; }
    .tab { padding: 10px 20px; cursor: pointer; font-size: 14px; color: #7f8c8d; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s; }
    .tab:hover { color: #2c3e50; }
    .tab.active { color: #3498db; border-bottom-color: #3498db; font-weight: 600; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* 分隔符选择 */
    .delimiter-options { display: flex; gap: 12px; flex-wrap: wrap; }
    .delimiter-opt { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 13px; }
    .delimiter-opt input { cursor: pointer; }

    /* 右键菜单样式 */
    .context-menu { position: fixed; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.15); padding: 6px 0; z-index: 100; min-width: 160px; }
    .context-menu-item { padding: 8px 16px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .context-menu-item:hover { background: #f0f8ff; color: #3498db; }
  </style>
</head>
<body>
  <div class="container">
    <h1>CSV 解析工具</h1>

    <!-- 文件选择 -->
    <div class="card">
      <h2>数据源</h2>
      <div class="file-list" id="fileList"></div>
      <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
            <input type="file" id="fileInput" accept=".csv,.tsv,.txt">
            <div class="upload-icon">&#128196;</div>
            <div class="upload-text">点击或拖拽上传 CSV 文件</div>
          </div>
        </div>
        <div>
          <textarea class="csv-input" id="csvInput" placeholder="或直接粘贴 CSV 内容...&#10;&#10;姓名,年龄,城市&#10;张三,28,北京&#10;李四,32,上海"></textarea>
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 13px; color: #7f8c8d;">分隔符:</span>
            <div class="delimiter-options">
              <label class="delimiter-opt"><input type="radio" name="manualDelimiter" value="auto" checked> 自动检测</label>
              <label class="delimiter-opt"><input type="radio" name="manualDelimiter" value=","> 逗号 (,)</label>
              <label class="delimiter-opt"><input type="radio" name="manualDelimiter" value=";"> 分号 (;)</label>
              <label class="delimiter-opt"><input type="radio" name="manualDelimiter" value="\\t"> Tab</label>
              <label class="delimiter-opt"><input type="radio" name="manualDelimiter" value="|"> 竖线 (|)</label>
            </div>
            <button class="btn btn-primary" onclick="parseManualInput()">解析</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据展示 -->
    <div id="dataPanel" style="display: none;">
      <div class="card">
        <div class="toolbar">
          <input type="text" id="searchInput" placeholder="搜索所有列...">
          <select id="pageSizeSelect">
            <option value="20">每页 20 条</option>
            <option value="50">每页 50 条</option>
            <option value="100">每页 100 条</option>
            <option value="999999">显示全部</option>
          </select>
          <button class="btn btn-success btn-sm" onclick="exportCSV()">导出 CSV</button>
          <button class="btn btn-primary btn-sm" onclick="exportJSON()">导出 JSON</button>
          <button class="btn btn-warning btn-sm" onclick="exportSQL()">导出 SQL</button>
          <span style="margin-left: auto; font-size: 13px; color: #7f8c8d;" id="dataInfo"></span>
        </div>

        <div class="tabs">
          <div class="tab active" data-tab="table" onclick="switchTab('table')">数据表格</div>
          <div class="tab" data-tab="stats" onclick="switchTab('stats')">列统计</div>
          <div class="tab" data-tab="raw" onclick="switchTab('raw')">原始数据</div>
        </div>

        <div class="tab-content active" id="tab-table">
          <div class="table-wrap">
            <table id="dataTable">
              <thead id="tableHead"></thead>
              <tbody id="tableBody"></tbody>
            </table>
          </div>
          <div class="pagination" id="pagination"></div>
        </div>

        <div class="tab-content" id="tab-stats">
          <div class="stats-grid" id="statsGrid"></div>
        </div>

        <div class="tab-content" id="tab-raw">
          <pre id="rawContent" style="max-height: 500px; overflow: auto; font-family: monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; background: #f8f9fa; padding: 16px; border-radius: 8px;"></pre>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let currentData = null;
    let currentPage = 1;
    let pageSize = 20;
    let sortColumn = null;
    let sortDirection = 'asc';
    let searchKeyword = '';

    // 加载文件列表
    async function loadFiles() {
      const res = await fetch('/api/files');
      const data = await res.json();
      const list = document.getElementById('fileList');
      if (!data.data.length) {
        list.innerHTML = '<div class="empty">暂无示例文件</div>';
        return;
      }
      list.innerHTML = data.data.map(f =>
        '<div class="file-card' + (currentData && currentData.id === f.id ? ' active' : '') + '" onclick="loadCSV(\\'' + f.id + '\\')">' +
          '<div class="file-card-name">' + f.filename + '</div>' +
          '<div class="file-card-meta">' + f.rows + ' 行 x ' + f.columns + ' 列 · ' + f.delimiterName + '</div>' +
        '</div>'
      ).join('');
    }

    // 加载 CSV 数据
    async function loadCSV(fileId) {
      const res = await fetch('/api/files/' + fileId);
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || '加载失败', 'error');
        return;
      }
      currentData = data.data;
      currentPage = 1;
      sortColumn = null;
      sortDirection = 'asc';
      searchKeyword = '';
      document.getElementById('searchInput').value = '';
      renderData();
      loadFiles(); // 刷新选中状态
    }

    // 渲染数据
    function renderData() {
      if (!currentData) return;
      document.getElementById('dataPanel').style.display = 'block';

      const headers = currentData.headers;
      let rows = [...currentData.rows];

      // 搜索过滤
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        rows = rows.filter(row =>
          headers.some(h => String(row[h] || '').toLowerCase().includes(kw))
        );
      }

      // 排序
      if (sortColumn) {
        rows.sort((a, b) => {
          let va = a[sortColumn] || '';
          let vb = b[sortColumn] || '';
          const na = parseFloat(va), nb = parseFloat(vb);
          if (!isNaN(na) && !isNaN(nb)) {
            return sortDirection === 'asc' ? na - nb : nb - na;
          }
          return sortDirection === 'asc'
            ? va.localeCompare(vb, 'zh')
            : vb.localeCompare(va, 'zh');
        });
      }

      const totalRows = rows.length;
      const totalPages = Math.ceil(totalRows / pageSize) || 1;
      if (currentPage > totalPages) currentPage = totalPages;

      const start = (currentPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);

      // 表头
      const thead = document.getElementById('tableHead');
      thead.innerHTML = '<tr>' +
        '<th style="width:50px">#</th>' +
        headers.map(h =>
          '<th class="' + (sortColumn === h ? 'sorted' : '') + '" onclick="toggleSort(\\'' + h.replace(/'/g, "\\\\'") + '\\')">' +
            h +
            '<span class="sort-icon">' + (sortColumn === h ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅') + '</span>' +
          '</th>'
        ).join('') +
      '</tr>';

      // 表体
      const tbody = document.getElementById('tableBody');
      if (!pageRows.length) {
        tbody.innerHTML = '<tr><td colspan="' + (headers.length + 1) + '" class="empty">无匹配数据</td></tr>';
      } else {
        tbody.innerHTML = pageRows.map((row, idx) =>
          '<tr>' +
            '<td style="color:#95a5a6">' + (start + idx + 1) + '</td>' +
            headers.map(h => {
              const val = String(row[h] || '');
              const isNum = val !== '' && !isNaN(val) && !isNaN(parseFloat(val));
              return '<td' + (isNum ? ' class="num"' : '') + ' title="' + val.replace(/"/g, '&quot;') + '">' + val + '</td>';
            }).join('') +
          '</tr>'
        ).join('');
      }

      // 分页
      renderPagination(totalRows, totalPages);

      // 数据信息
      document.getElementById('dataInfo').textContent =
        '共 ' + totalRows + ' 条' + (searchKeyword ? ' (已过滤)' : '') + ' · ' + headers.length + ' 列';

      // 统计面板
      renderStats(headers, currentData.rows);

      // 原始数据
      renderRaw(headers, currentData.rawRows);
    }

    // 分页
    function renderPagination(total, totalPages) {
      const el = document.getElementById('pagination');
      if (totalPages <= 1) { el.innerHTML = ''; return; }

      let html = '<button class="page-btn" onclick="goPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>&lt;</button>';

      const range = getPageRange(currentPage, totalPages);
      for (const p of range) {
        if (p === '...') {
          html += '<span class="page-info">...</span>';
        } else {
          html += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" onclick="goPage(' + p + ')">' + p + '</button>';
        }
      }

      html += '<button class="page-btn" onclick="goPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>&gt;</button>';
      html += '<span class="page-info">共 ' + total + ' 条</span>';
      el.innerHTML = html;
    }

    function getPageRange(current, total) {
      if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
      const pages = [];
      pages.push(1);
      if (current > 3) pages.push('...');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      pages.push(total);
      return pages;
    }

    function goPage(p) { currentPage = p; renderData(); }

    // 排序
    function toggleSort(col) {
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'asc';
      }
      currentPage = 1;
      renderData();
    }

    // 统计面板
    function renderStats(headers, rows) {
      const grid = document.getElementById('statsGrid');
      grid.innerHTML = headers.map(h => {
        const values = rows.map(r => r[h]);
        const stats = calcStats(values);
        let body = '';
        body += '<span class="stat-badge ' + stats.type + '">' + (stats.type === 'number' ? '数值' : '文本') + '</span><br>';
        body += '非空: ' + stats.nonEmpty + ' / 空值: ' + stats.empty + '<br>';
        body += '唯一值: ' + stats.unique + '<br>';
        if (stats.type === 'number') {
          body += '最小: ' + stats.min + '<br>';
          body += '最大: ' + stats.max + '<br>';
          body += '平均: ' + stats.avg + '<br>';
          body += '总和: ' + stats.sum.toLocaleString();
        } else if (stats.topValues) {
          body += '高频值:<br>';
          body += stats.topValues.map(v => '&nbsp;&nbsp;' + v.val + ' (' + v.count + ')').join('<br>');
        }
        return '<div class="stat-card"><div class="stat-card-header">' + h + '</div><div class="stat-card-body">' + body + '</div></div>';
      }).join('');
    }

    function calcStats(values) {
      const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
      const numericVals = nonEmpty.filter(v => v !== '' && !isNaN(v) && !isNaN(parseFloat(v))).map(Number);
      const stats = { total: values.length, nonEmpty: nonEmpty.length, empty: values.length - nonEmpty.length, unique: new Set(nonEmpty).size };

      if (numericVals.length > nonEmpty.length * 0.5 && numericVals.length > 0) {
        stats.type = 'number';
        stats.min = Math.min(...numericVals);
        stats.max = Math.max(...numericVals);
        stats.sum = numericVals.reduce((a, b) => a + b, 0);
        stats.avg = +(stats.sum / numericVals.length).toFixed(2);
      } else {
        stats.type = 'text';
        const freq = {};
        for (const v of nonEmpty) freq[v] = (freq[v] || 0) + 1;
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        stats.topValues = sorted.slice(0, 5).map(([val, count]) => ({ val, count }));
      }
      return stats;
    }

    // 原始数据
    function renderRaw(headers, rawRows) {
      const el = document.getElementById('rawContent');
      el.textContent = rawRows.map(row => row.join(currentData.delimiter === '\\t' ? '\\t' : currentData.delimiter)).join('\\n');
    }

    // 标签页切换
    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    }

    // 搜索
    document.getElementById('searchInput').addEventListener('input', function() {
      searchKeyword = this.value;
      currentPage = 1;
      renderData();
    });

    // 每页条数
    document.getElementById('pageSizeSelect').addEventListener('change', function() {
      pageSize = parseInt(this.value);
      currentPage = 1;
      renderData();
    });

    // 手动输入解析
    async function parseManualInput() {
      const content = document.getElementById('csvInput').value.trim();
      if (!content) { showToast('请输入 CSV 内容', 'error'); return; }

      const delimiterRadio = document.querySelector('input[name="manualDelimiter"]:checked');
      const delimiterVal = delimiterRadio.value;

      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, delimiter: delimiterVal })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || '解析失败', 'error'); return; }

      currentData = data.data;
      currentPage = 1;
      sortColumn = null;
      sortDirection = 'asc';
      searchKeyword = '';
      document.getElementById('searchInput').value = '';
      renderData();
      loadFiles();
      showToast('解析成功: ' + data.data.rows.length + ' 行 x ' + data.data.headers.length + ' 列', 'success');
    }

    // 文件上传
    document.getElementById('fileInput').addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) { showToast(data.error || '上传失败', 'error'); return; }
        currentData = data.data;
        currentPage = 1;
        sortColumn = null;
        renderData();
        loadFiles();
        showToast('上传解析成功', 'success');
      } catch (err) {
        showToast('上传失败: ' + err.message, 'error');
      }
      this.value = '';
    });

    // 拖拽上传
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', async e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) { showToast(data.error || '上传失败', 'error'); return; }
        currentData = data.data;
        currentPage = 1;
        sortColumn = null;
        renderData();
        loadFiles();
        showToast('上传解析成功', 'success');
      } catch (err) {
        showToast('上传失败: ' + err.message, 'error');
      }
    });

    // 导出 CSV
    function exportCSV() {
      if (!currentData) return;
      window.open('/api/export/' + currentData.id + '?format=csv', '_blank');
    }

    // 导出 JSON
    function exportJSON() {
      if (!currentData) return;
      window.open('/api/export/' + currentData.id + '?format=json', '_blank');
    }

    // 导出 SQL
    function exportSQL() {
      if (!currentData) return;
      window.open('/api/export/' + currentData.id + '?format=sql', '_blank');
    }

    // Toast
    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast show ' + type;
      setTimeout(() => toast.className = 'toast', 2500);
    }

    // 初始化
    loadFiles();
  </script>
</body>
</html>`;
  sendHTML(res, html);
}

/** GET /api/files — 获取文件列表 */
function handleListFiles(req, res) {
  const files = [];
  for (const [id, data] of csvStore) {
    const delimiterName =
      data.delimiter === ','
        ? '逗号'
        : data.delimiter === ';'
          ? '分号'
          : data.delimiter === '\t'
            ? 'Tab'
            : data.delimiter === '|'
              ? '竖线'
              : data.delimiter;
    files.push({
      id,
      filename: data.filename,
      rows: data.rows.length,
      columns: data.headers.length,
      delimiterName,
      uploadedAt: data.uploadedAt,
    });
  }
  send(res, 200, { success: true, data: files });
}

/** GET /api/files/:id — 获取指定 CSV 数据 */
function handleGetFile(req, res, fileId) {
  const data = csvStore.get(fileId);
  if (!data) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }
  send(res, 200, {
    success: true,
    data: {
      id: data.id,
      headers: data.headers,
      rows: data.rows,
      rawRows: data.rawRows,
      delimiter: data.delimiter,
      filename: data.filename,
    },
  });
}

/** POST /api/upload — 上传 CSV 文件 */
async function handleUpload(req, res) {
  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return send(res, 400, {
        success: false,
        error: '需要 multipart/form-data',
      });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return send(res, 400, { success: false, error: '缺少 boundary' });
    }

    const body = await readBody(req, 10 * 1024 * 1024);
    const parts = parseMultipart(body, boundary);

    const filePart = parts.find((p) => p.filename);
    if (!filePart) {
      return send(res, 400, { success: false, error: '未找到上传文件' });
    }

    const content = filePart.content.toString('utf-8');
    const delimiter = CSVParser.detectDelimiter(content);
    const parser = new CSVParser({ delimiter });
    const result = parser.parse(content);

    if (result.headers.length === 0) {
      return send(res, 400, {
        success: false,
        error: '无法解析 CSV，文件可能为空',
      });
    }

    const id = String(++fileIdCounter);
    const entry = {
      id,
      headers: result.headers,
      rows: result.rows,
      rawRows: result.rawRows,
      delimiter,
      filename: filePart.filename,
      uploadedAt: new Date().toISOString(),
    };
    csvStore.set(id, entry);

    send(res, 200, {
      success: true,
      data: {
        id,
        headers: result.headers,
        rows: result.rows,
        rawRows: result.rawRows,
        delimiter,
        filename: filePart.filename,
      },
    });
  } catch (err) {
    console.error('上传处理错误:', err);
    send(res, 500, { success: false, error: '上传处理失败: ' + err.message });
  }
}

/** POST /api/parse — 解析手动输入的 CSV */
function handleParse(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.destroy();
      send(res, 413, { success: false, error: '内容过大' });
    }
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const content = parsed.content;
      if (!content || !content.trim()) {
        return send(res, 400, { success: false, error: '内容为空' });
      }

      let delimiter = parsed.delimiter || 'auto';
      if (delimiter === 'auto') {
        delimiter = CSVParser.detectDelimiter(content);
      } else if (delimiter === '\\t' || delimiter === '\t') {
        delimiter = '\t';
      }

      const parser = new CSVParser({ delimiter });
      const result = parser.parse(content);

      if (result.headers.length === 0) {
        return send(res, 400, { success: false, error: '无法解析 CSV' });
      }

      const id = String(++fileIdCounter);
      const entry = {
        id,
        headers: result.headers,
        rows: result.rows,
        rawRows: result.rawRows,
        delimiter,
        filename: '手动输入',
        uploadedAt: new Date().toISOString(),
      };
      csvStore.set(id, entry);

      send(res, 200, {
        success: true,
        data: {
          id,
          headers: result.headers,
          rows: result.rows,
          rawRows: result.rawRows,
          delimiter,
          filename: '手动输入',
        },
      });
    } catch (err) {
      send(res, 400, { success: false, error: '解析失败: ' + err.message });
    }
  });
}

/** GET /api/export/:id — 导出数据 */
function handleExport(req, res, fileId, parsedUrl) {
  const data = csvStore.get(fileId);
  if (!data) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  const format = (parsedUrl.query && parsedUrl.query.format) || 'csv';

  if (format === 'csv') {
    const csv = serializeCSV(data.headers, data.rows, {
      delimiter: data.delimiter,
    });
    const baseName = data.filename.replace(/\.\w+$/, '');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(baseName + '.csv')}`,
    });
    res.end(csv, 'utf-8');
  } else if (format === 'json') {
    const json = JSON.stringify(
      { headers: data.headers, rows: data.rows, total: data.rows.length },
      null,
      2
    );
    const baseName = data.filename.replace(/\.\w+$/, '');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(baseName + '.json')}`,
    });
    res.end(json, 'utf-8');
  } else if (format === 'sql') {
    const tableName =
      data.filename.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').replace(/^_+|_+$/g, '') ||
      'csv_data';
    const safeColumns = data.headers.map((h) => h.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_'));
    const lines = [];

    // CREATE TABLE
    lines.push(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (`);
    lines.push(`  id INTEGER PRIMARY KEY AUTOINCREMENT,`);
    lines.push(data.headers.map((h, i) => `  \`${safeColumns[i]}\` TEXT`).join(',\n'));
    lines.push(');');
    lines.push('');

    // INSERT
    for (const row of data.rows) {
      const values = data.headers.map((h) => {
        const v = row[h] || '';
        return "'" + v.replace(/'/g, "''") + "'";
      });
      const cols = safeColumns.map((c) => `\`${c}\``).join(', ');
      lines.push(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${values.join(', ')});`);
    }

    const baseName = data.filename.replace(/\.\w+$/, '');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(baseName + '.sql')}`,
    });
    res.end(lines.join('\n'), 'utf-8');
  } else {
    send(res, 400, { success: false, error: '不支持的导出格式: ' + format });
  }
}

/** GET /api/stats/:id — 获取列统计 */
function handleStats(req, res, fileId) {
  const data = csvStore.get(fileId);
  if (!data) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  const stats = {};
  for (const h of data.headers) {
    stats[h] = columnStats(data.rows.map((r) => r[h]));
  }

  send(res, 200, {
    success: true,
    data: { headers: data.headers, stats, totalRows: data.rows.length },
  });
}

// ============================================================
// 7. HTTP 请求路由
// ============================================================
function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // GET / — 主页面
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res);
    }

    // GET /api/files — 文件列表
    if (method === 'GET' && pathname === '/api/files') {
      return handleListFiles(req, res);
    }

    // POST /api/upload — 上传文件
    if (method === 'POST' && pathname === '/api/upload') {
      return handleUpload(req, res);
    }

    // POST /api/parse — 解析手动输入
    if (method === 'POST' && pathname === '/api/parse') {
      return handleParse(req, res);
    }

    // GET /api/export/:id — 导出
    const exportMatch = pathname.match(/^\/api\/export\/([^/]+)$/);
    if (method === 'GET' && exportMatch) {
      return handleExport(req, res, exportMatch[1], parsedUrl);
    }

    // GET /api/stats/:id — 统计
    const statsMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
    if (method === 'GET' && statsMatch) {
      return handleStats(req, res, statsMatch[1]);
    }

    // GET /api/files/:id — 获取文件数据
    const fileMatch = pathname.match(/^\/api\/files\/([^/]+)$/);
    if (method === 'GET' && fileMatch) {
      return handleGetFile(req, res, fileMatch[1]);
    }

    send(res, 404, { success: false, error: '路由不存在' });
  } catch (err) {
    console.error('请求处理错误:', err);
    send(res, 500, { success: false, error: '内部服务器错误' });
  }
}

// ============================================================
// 8. 启动服务
// ============================================================
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║              CSV 解析工具 - CSV Parser Tool               ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║   服务地址: http://localhost:${PORT}                        ║
  ║                                                          ║
  ║   功能特性:                                               ║
  ║     • 纯 Node.js 实现，零外部依赖                          ║
  ║     • 支持 RFC 4180 标准的 CSV 解析                       ║
  ║     • 自动检测分隔符（逗号/Tab/分号/竖线）                  ║
  ║     • 引号字段 & 转义引号处理                               ║
  ║     • BOM 头自动处理                                      ║
  ║     • 文件上传 & 拖拽上传                                  ║
  ║     • 手动输入 CSV 内容解析                                ║
  ║     • 数据表格展示（排序/搜索/分页）                        ║
  ║     • 列统计分析（数值/文本类型自动识别）                    ║
  ║     • 导出 CSV / JSON / SQL                               ║
  ║     • 预置 5 个示例数据文件                                ║
  ║                                                          ║
  ║   API 端点:                                               ║
  ║     GET  /                     主页面（HTML）              ║
  ║     GET  /api/files            文件列表                    ║
  ║     GET  /api/files/:id        获取 CSV 数据               ║
  ║     POST /api/upload           上传 CSV 文件               ║
  ║     POST /api/parse            解析手动输入                 ║
  ║     GET  /api/stats/:id        列统计                      ║
  ║     GET  /api/export/:id       导出数据                    ║
  ║         ?format=csv|json|sql                             ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n服务正在关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});
