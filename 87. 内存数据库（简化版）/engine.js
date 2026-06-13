// 内存数据库引擎：表、主键、二级索引、查询
class Table {
  constructor(name, schema = {}) {
    this.name = name;
    this.schema = schema; // {field: {type, unique, index}}
    this.rows = new Map(); // pk => row
    this.pkField = schema.pk || 'id';
    this.autoId = 1;
    this.indexes = new Map(); // field => Map(value => Set(pk))
    for (const [f, def] of Object.entries(schema.fields || {})) {
      if (def.index || def.unique) this.indexes.set(f, new Map());
    }
  }

  insert(row) {
    if (row[this.pkField] === undefined) row[this.pkField] = this.autoId++;
    else if (typeof row[this.pkField] === 'number' && row[this.pkField] >= this.autoId) {
      this.autoId = row[this.pkField] + 1;
    }
    const pk = row[this.pkField];
    if (this.rows.has(pk)) throw new Error(`主键冲突: ${pk}`);
    this.rows.set(pk, row);
    for (const field of this.indexes.keys()) {
      this._addIndex(field, row[field], pk);
    }
    return row;
  }

  update(pk, patch) {
    const row = this.rows.get(pk);
    if (!row) return null;
    for (const field of this.indexes.keys()) {
      if (field in patch && row[field] !== patch[field]) {
        this._removeIndex(field, row[field], pk);
        this._addIndex(field, patch[field], pk);
      }
    }
    Object.assign(row, patch);
    return row;
  }

  delete(pk) {
    const row = this.rows.get(pk);
    if (!row) return false;
    for (const field of this.indexes.keys()) {
      this._removeIndex(field, row[field], pk);
    }
    return this.rows.delete(pk);
  }

  get(pk) { return this.rows.get(pk); }

  // 简单 where：{field: value} 或 {field: {op: 'gt', value: x}}
  find(where = {}, options = {}) {
    let candidates = null;
    // 利用索引
    for (const [field, cond] of Object.entries(where)) {
      if (this.indexes.has(field) && (typeof cond !== 'object' || cond === null)) {
        const set = this.indexes.get(field).get(cond);
        const ids = set ? [...set] : [];
        candidates = candidates ? candidates.filter(id => ids.includes(id)) : ids;
      }
    }
    let rows = candidates ? candidates.map(id => this.rows.get(id)) : [...this.rows.values()];
    rows = rows.filter(r => this._match(r, where));
    if (options.orderBy) {
      const [field, dir] = options.orderBy.split(/\s+/);
      rows.sort((a, b) => {
        if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
        if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
        return 0;
      });
    }
    if (options.offset) rows = rows.slice(options.offset);
    if (options.limit) rows = rows.slice(0, options.limit);
    return rows;
  }

  _match(row, where) {
    for (const [field, cond] of Object.entries(where)) {
      const v = row[field];
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        const { op, value } = cond;
        if (op === 'gt' && !(v > value)) return false;
        if (op === 'gte' && !(v >= value)) return false;
        if (op === 'lt' && !(v < value)) return false;
        if (op === 'lte' && !(v <= value)) return false;
        if (op === 'ne' && !(v !== value)) return false;
        if (op === 'in' && !value.includes(v)) return false;
        if (op === 'like' && !new RegExp(value, 'i').test(v)) return false;
      } else {
        if (v !== cond) return false;
      }
    }
    return true;
  }

  _addIndex(field, value, pk) {
    const idx = this.indexes.get(field);
    if (!idx.has(value)) idx.set(value, new Set());
    idx.get(value).add(pk);
  }
  _removeIndex(field, value, pk) {
    const idx = this.indexes.get(field);
    const set = idx.get(value);
    if (set) { set.delete(pk); if (set.size === 0) idx.delete(value); }
  }

  count() { return this.rows.size; }
  toJSON() { return { name: this.name, schema: this.schema, rows: [...this.rows.values()] }; }
}

class Database {
  constructor() { this.tables = new Map(); }
  createTable(name, schema) {
    if (this.tables.has(name)) throw new Error(`表已存在: ${name}`);
    const t = new Table(name, schema);
    this.tables.set(name, t);
    return t;
  }
  dropTable(name) { return this.tables.delete(name); }
  table(name) {
    const t = this.tables.get(name);
    if (!t) throw new Error(`表不存在: ${name}`);
    return t;
  }
}

module.exports = { Database, Table };
