// IM 数据存储 - 用户、群组、消息、离线消息
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
  constructor() {
    this.usersFile = path.join(__dirname, 'users.json');
    this.messagesFile = path.join(__dirname, 'messages.json');
    this.groupsFile = path.join(__dirname, 'groups.json');
    this.users = new Map(); // username -> { username, passHash, friends: [], groups: [] }
    this.messages = []; // 消息历史
    this.offline = new Map(); // username -> [messages]
    this.groups = new Map(); // groupId -> { id, name, members: [] }
    this.load();
  }

  hashPwd(pwd) {
    return crypto.createHash('sha256').update(pwd).digest('hex');
  }

  register(username, password) {
    if (this.users.has(username)) return { ok: false, error: '用户名已存在' };
    this.users.set(username, {
      username,
      passHash: this.hashPwd(password),
      friends: [],
      groups: [],
      createdAt: Date.now(),
    });
    this.save();
    return { ok: true };
  }

  login(username, password) {
    const user = this.users.get(username);
    if (!user || user.passHash !== this.hashPwd(password)) {
      return { ok: false, error: '账号或密码错误' };
    }
    return { ok: true, user };
  }

  addFriend(username, friend) {
    const u = this.users.get(username);
    const f = this.users.get(friend);
    if (!u || !f) return { ok: false, error: '用户不存在' };
    if (!u.friends.includes(friend)) u.friends.push(friend);
    if (!f.friends.includes(username)) f.friends.push(username);
    this.save();
    return { ok: true };
  }

  createGroup(name, owner) {
    const id = 'g_' + crypto.randomBytes(4).toString('hex');
    const group = { id, name, owner, members: [owner], createdAt: Date.now() };
    this.groups.set(id, group);
    const u = this.users.get(owner);
    if (u && !u.groups.includes(id)) u.groups.push(id);
    this.save();
    return group;
  }

  joinGroup(groupId, username) {
    const g = this.groups.get(groupId);
    const u = this.users.get(username);
    if (!g || !u) return { ok: false, error: '不存在' };
    if (!g.members.includes(username)) g.members.push(username);
    if (!u.groups.includes(groupId)) u.groups.push(groupId);
    this.save();
    return { ok: true, group: g };
  }

  saveMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > 5000) this.messages = this.messages.slice(-3000);
    this.save();
  }

  saveOffline(username, msg) {
    if (!this.offline.has(username)) this.offline.set(username, []);
    this.offline.get(username).push(msg);
  }

  getOffline(username) {
    const list = this.offline.get(username) || [];
    this.offline.delete(username);
    return list;
  }

  getHistory(filter, limit = 50) {
    return this.messages.filter(filter).slice(-limit);
  }

  save() {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify([...this.users.values()]));
      fs.writeFileSync(this.messagesFile, JSON.stringify(this.messages));
      fs.writeFileSync(this.groupsFile, JSON.stringify([...this.groups.values()]));
    } catch (_) {}
  }

  load() {
    try {
      if (fs.existsSync(this.usersFile)) {
        JSON.parse(fs.readFileSync(this.usersFile, 'utf8')).forEach((u) =>
          this.users.set(u.username, u)
        );
      }
      if (fs.existsSync(this.messagesFile)) {
        this.messages = JSON.parse(fs.readFileSync(this.messagesFile, 'utf8'));
      }
      if (fs.existsSync(this.groupsFile)) {
        JSON.parse(fs.readFileSync(this.groupsFile, 'utf8')).forEach((g) =>
          this.groups.set(g.id, g)
        );
      }
    } catch (_) {}
  }
}

module.exports = new Store();
