// 告警规则引擎
class AlertManager {
  constructor() {
    this.rules = [];
    this.firing = new Map(); // ruleId => { since }
    this.history = [];
  }

  addRule(rule) {
    // rule: { id, name, metric, op, threshold, duration }
    rule.id = rule.id || `rule-${this.rules.length + 1}`;
    this.rules.push(rule);
    return rule.id;
  }

  evaluate(snapshot) {
    const now = Date.now();
    const alerts = [];
    for (const rule of this.rules) {
      const m = snapshot[rule.metric];
      if (!m) continue;
      const value = this.extract(m, rule.field);
      const triggered = this.compare(value, rule.op, rule.threshold);
      const state = this.firing.get(rule.id);
      if (triggered) {
        if (!state) {
          this.firing.set(rule.id, { since: now });
        } else if (now - state.since >= (rule.duration || 0)) {
          if (!state.fired) {
            state.fired = true;
            const alert = {
              id: rule.id, name: rule.name, value, threshold: rule.threshold,
              op: rule.op, ts: now, status: 'firing'
            };
            alerts.push(alert);
            this.history.push(alert);
            console.log(`[ALERT] ${rule.name}: ${value} ${rule.op} ${rule.threshold}`);
          }
        }
      } else {
        if (state && state.fired) {
          const alert = { id: rule.id, name: rule.name, ts: now, status: 'resolved' };
          alerts.push(alert);
          this.history.push(alert);
          console.log(`[RESOLVED] ${rule.name}`);
        }
        this.firing.delete(rule.id);
      }
    }
    return alerts;
  }

  extract(metric, field) {
    if (!field) return metric.value !== undefined ? metric.value : metric.count;
    return metric[field];
  }

  compare(a, op, b) {
    switch (op) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '==': return a == b;
      default: return false;
    }
  }
}

module.exports = AlertManager;
