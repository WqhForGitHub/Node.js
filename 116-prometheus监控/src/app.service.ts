import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge, Counter } from 'prom-client';
@Injectable()
export class AppService {
  private registry: Registry;
  private counter: Counter;
  private gauge: Gauge;
  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });
    this.counter = new Counter({
      name: 'app_requests_total',
      help: 'Total requests',
      registers: [this.registry],
    });
    this.gauge = new Gauge({
      name: 'app_active_connections',
      help: 'Active connections',
      registers: [this.registry],
    });
    this.counter.inc();
    this.gauge.set(1);
  }
  metrics() {
    return this.registry.metrics();
  }
}
