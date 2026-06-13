// IoT 设备注册中心 - 管理设备元数据、状态、分组
const fs = require('fs');
const path = require('path');

class DeviceRegistry {
  constructor(file = path.join(__dirname, 'devices.json')) {
    this.file = file;
    this.devices = new Map();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const d of data) this.devices.set(d.id, d);
    } catch (e) {
      console.error('加载设备失败:', e.message);
    }
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify([...this.devices.values()], null, 2));
  }

  register(id, info = {}) {
    const now = Date.now();
    const device = this.devices.get(id) || {
      id,
      createdAt: now,
      status: 'offline',
      lastSeen: 0,
      group: info.group || 'default',
      type: info.type || 'sensor',
      meta: {}
    };
    Object.assign(device, info, { id, lastSeen: now, status: 'online' });
    this.devices.set(id, device);
    this.save();
    return device;
  }

  heartbeat(id) {
    const d = this.devices.get(id);
    if (!d) return false;
    d.lastSeen = Date.now();
    d.status = 'online';
    return true;
  }

  markOffline(id) {
    const d = this.devices.get(id);
    if (d) d.status = 'offline';
  }

  remove(id) {
    const ok = this.devices.delete(id);
    if (ok) this.save();
    return ok;
  }

  get(id) { return this.devices.get(id); }
  list(filter = {}) {
    let arr = [...this.devices.values()];
    if (filter.group) arr = arr.filter(d => d.group === filter.group);
    if (filter.status) arr = arr.filter(d => d.status === filter.status);
    if (filter.type) arr = arr.filter(d => d.type === filter.type);
    return arr;
  }

  // 检查超时设备
  reapStale(timeoutMs = 30000) {
    const now = Date.now();
    let count = 0;
    for (const d of this.devices.values()) {
      if (d.status === 'online' && now - d.lastSeen > timeoutMs) {
        d.status = 'offline';
        count++;
      }
    }
    return count;
  }
}

module.exports = DeviceRegistry;
