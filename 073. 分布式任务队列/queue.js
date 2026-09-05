// 分布式任务队列核心实现 - 纯 Node.js
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TaskQueue extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.persistFile = options.persistFile || path.join(__dirname, `queue-${name}.json`);
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.tasks = new Map(); // taskId -> task
    this.pending = []; // 待处理 taskId 列表
    this.processing = new Map(); // taskId -> { workerId, startTime }
    this.completed = [];
    this.failed = [];
    this.delayed = new Map(); // taskId -> timer

    this.load();
    // 定时持久化
    this.persistTimer = setInterval(() => this.persist(), 3000);
  }

  // 添加任务
  add(type, payload, options = {}) {
    const id = crypto.randomBytes(8).toString('hex');
    const task = {
      id,
      type,
      payload,
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: 0,
      maxRetries: options.maxRetries ?? this.maxRetries,
      createdAt: Date.now(),
      status: 'pending',
    };
    this.tasks.set(id, task);

    if (task.delay > 0) {
      task.status = 'delayed';
      const timer = setTimeout(() => {
        task.status = 'pending';
        this.delayed.delete(id);
        this._enqueue(id);
      }, task.delay);
      this.delayed.set(id, timer);
    } else {
      this._enqueue(id);
    }
    this.emit('added', task);
    return id;
  }

  _enqueue(id) {
    const task = this.tasks.get(id);
    if (!task) return;
    // 按优先级插入
    let inserted = false;
    for (let i = 0; i < this.pending.length; i++) {
      const t = this.tasks.get(this.pending[i]);
      if (task.priority > t.priority) {
        this.pending.splice(i, 0, id);
        inserted = true;
        break;
      }
    }
    if (!inserted) this.pending.push(id);
    this.emit('enqueued', task);
  }

  // 工作进程取出任务
  reserve(workerId) {
    if (this.pending.length === 0) return null;
    const id = this.pending.shift();
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = 'processing';
    task.attempts += 1;
    this.processing.set(id, { workerId, startTime: Date.now() });
    this.emit('reserved', task, workerId);
    return task;
  }

  // 完成任务
  complete(id, result) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'completed';
    task.result = result;
    task.completedAt = Date.now();
    this.processing.delete(id);
    this.completed.push(id);
    this.emit('completed', task);
  }

  // 任务失败
  fail(id, error) {
    const task = this.tasks.get(id);
    if (!task) return;
    task.lastError = error;
    this.processing.delete(id);

    if (task.attempts < task.maxRetries) {
      task.status = 'pending';
      // 延迟重试
      setTimeout(() => this._enqueue(id), this.retryDelay * task.attempts);
      this.emit('retry', task);
    } else {
      task.status = 'failed';
      task.failedAt = Date.now();
      this.failed.push(id);
      this.emit('failed', task);
    }
  }

  stats() {
    return {
      name: this.name,
      total: this.tasks.size,
      pending: this.pending.length,
      processing: this.processing.size,
      delayed: this.delayed.size,
      completed: this.completed.length,
      failed: this.failed.length,
    };
  }

  // 持久化
  persist() {
    try {
      const data = {
        tasks: [...this.tasks.values()],
        pending: this.pending,
        completed: this.completed,
        failed: this.failed,
      };
      fs.writeFileSync(this.persistFile, JSON.stringify(data));
    } catch (e) {
      console.error('持久化失败:', e.message);
    }
  }

  load() {
    if (!fs.existsSync(this.persistFile)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistFile, 'utf8'));
      data.tasks.forEach((t) => {
        // 重启时把 processing 状态恢复为 pending
        if (t.status === 'processing') t.status = 'pending';
        this.tasks.set(t.id, t);
      });
      this.pending = (data.pending || []).filter((id) => {
        const t = this.tasks.get(id);
        return t && t.status === 'pending';
      });
      // 恢复未在 pending 中但状态为 pending 的任务
      data.tasks.forEach((t) => {
        if (t.status === 'pending' && !this.pending.includes(t.id)) {
          this.pending.push(t.id);
        }
      });
      this.completed = data.completed || [];
      this.failed = data.failed || [];
      console.log(
        `[${this.name}] 已加载 ${this.tasks.size} 个任务，${this.pending.length} 个待处理`
      );
    } catch (e) {
      console.error('加载失败:', e.message);
    }
  }

  shutdown() {
    clearInterval(this.persistTimer);
    for (const timer of this.delayed.values()) clearTimeout(timer);
    this.persist();
  }
}

module.exports = TaskQueue;
