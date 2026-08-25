import { Injectable } from '@nestjs/common';
@Injectable()
export class EventStore {
  private events: {
    aggregateId: string;
    type: string;
    data: any;
    version: number;
  }[] = [];
  append(aggregateId: string, type: string, data: any) {
    this.events.push({
      aggregateId,
      type,
      data,
      version: this.events.length + 1,
    });
  }
  load(aggregateId: string) {
    return this.events.filter((e) => e.aggregateId === aggregateId);
  }
  loadAll() {
    return this.events;
  }
}
