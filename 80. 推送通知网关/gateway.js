// 推送网关核心
// - 设备注册（device token）
// - 标签订阅（topic）
// - 单播/广播/标签推送
// - 离线消息（最多 100 条/设备）
// - QoS：at-most-once / at-least-once（带 ack 重传）
// - 消息持久化

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

class Gateway extends EventEmitter {
  constructor() {
    super();
    this.devicesFile = path.join(__dirname, 'devices.json');
    this.topicsFile = path.join(__dirname, 'topics.json');
    this.devices = new Map();    // deviceId -> { userId, platform, topics: [], offline: [] }
    this.topics = new Map();     // topic -> Set(deviceId)
    this.online = new Map();     // deviceId -> conn
    this.pendingAck = new Map(); // msgId -> { deviceId, msg, timer, retries }
    this.metrics = {
      sent: 0, delivered: 0, failed: 0, queued: 0
    };
    this.load();
  }

  registerDevice(deviceId, userId, platform) {
    if (!this.devices.has(deviceId)) {
      this.devices.set(deviceId, {
        deviceId, userId, platform,
        topics: [], offline: [],
        registeredAt: Date.now()
      });
      this.save();
    } else {
      const d = this.devices.get(deviceId);
      d.userId = userId; d.platform = platform;
    }
    return this.devices.get(deviceId);
  }

  subscribe(deviceId, topic) {
    const d = this.devices.get(deviceId);
    if (!d) return false;
    if (!d.topics.includes(topic)) d.topics.push(topic);
    if (!this.topics.has(topic)) this.topics.set(topic, new Set());
    this.topics.get(topic).add(deviceId);
    this.save();
    return true;
  }

  unsubscribe(deviceId, topic) {
    const d = this.devices.get(deviceId);
    if (d) d.topics = d.topics.filter(t => t !== topic);
    const s = this.topics.get(topic);
    if (s) {
      s.delete(deviceId);
      if (s.size === 0) this.topics.delete(topic);
    }
    this.save();
  }

  setOnline(deviceId, conn) {
    this.online.set(deviceId, conn);
    // 推送离线消息
    const d = this.devices.get(deviceId);
    if (d && d.offline.length > 0) {
      for (const msg of d.offline) {
        this._send(deviceId, msg);
      }
      d.offline = [];
    }
  }

  setOffline(deviceId) {
    this.online.delete(deviceId);
  }

  // 内部发送
  _send(deviceId, msg) {
    const conn = this.online.get(deviceId);
    if (conn) {
      conn.send(msg);
      this.metrics.sent++;
      // QoS 1: 等待 ack
      if (msg.qos === 1 && msg.id) {
        const timer = setTimeout(() => this._retry(msg.id), 5000);
        this.pendingAck.set(msg.id, { deviceId, msg, timer, retries: 0 });
      } else {
        this.metrics.delivered++;
      }
      return true;
    } else {
      // 入离线队列
      const d = this.devices.get(deviceId);
      if (d) {
        d.offline.push(msg);
        if (d.offline.length > 100) d.offline = d.offline.slice(-100);
        this.metrics.queued++;
      }
      return false;
    }
  }

  ack(msgId) {
    const p = this.pendingAck.get(msgId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pendingAck.delete(msgId);
    this.metrics.delivered++;
  }

  _retry(msgId) {
    const p = this.pendingAck.get(msgId);
    if (!p) return;
    p.retries++;
    if (p.retries >= 3) {
      this.pendingAck.delete(msgId);
      this.metrics.failed++;
      // 入离线队列
      const d = this.devices.get(p.deviceId);
      if (d) d.offline.push(p.msg);
      return;
    }
    this._send(p.deviceId, p.msg);
  }

  // 公开 API: 推送
  pushToDevice(deviceId, payload, opts = {}) {
    const msg = this._buildMsg(payload, opts);
    return this._send(deviceId, msg);
  }

  pushToUser(userId, payload, opts = {}) {
    let count = 0;
    for (const d of this.devices.values()) {
      if (d.userId === userId) {
        const msg = this._buildMsg(payload, opts);
        if (this._send(d.deviceId, msg)) count++;
      }
    }
    return count;
  }

  pushToTopic(topic, payload, opts = {}) {
    const set = this.topics.get(topic);
    if (!set) return 0;
    let count = 0;
    for (const deviceId of set) {
      const msg = this._buildMsg(payload, opts);
      if (this._send(deviceId, msg)) count++;
    }
    return count;
  }

  broadcast(payload, opts = {}) {
    let count = 0;
    for (const deviceId of this.devices.keys()) {
      const msg = this._buildMsg(payload, opts);
      if (this._send(deviceId, msg)) count++;
    }
    return count;
  }

  _buildMsg(payload, opts) {
    return {
      type: 'push',
      id: crypto.randomBytes(6).toString('hex'),
      qos: opts.qos || 0,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      ts: Date.now(),
      ttl: opts.ttl
    };
  }

  save() {
    try {
      fs.writeFileSync(this.devicesFile, JSON.stringify([...this.devices.values()]));
      fs.writeFileSync(this.topicsFile, JSON.stringify(
        [...this.topics].map(([t, s]) => ({ topic: t, devices: [...s] }))
      ));
    } catch (_) {}
  }

  load() {
    try {
      if (fs.existsSync(this.devicesFile)) {
        JSON.parse(fs.readFileSync(this.devicesFile, 'utf8')).forEach(d => this.devices.set(d.deviceId, d));
      }
      if (fs.existsSync(this.topicsFile)) {
        JSON.parse(fs.readFileSync(this.topicsFile, 'utf8')).forEach(t =>
          this.topics.set(t.topic, new Set(t.devices)));
      }
      console.log(`已加载 ${this.devices.size} 个设备, ${this.topics.size} 个主题`);
    } catch (_) {}
  }

  stats() {
    return {
      ...this.metrics,
      devices: this.devices.size,
      online: this.online.size,
      topics: this.topics.size,
      pendingAck: this.pendingAck.size
    };
  }
}

module.exports = Gateway;
