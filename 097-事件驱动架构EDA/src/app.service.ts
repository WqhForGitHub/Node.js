import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
@Injectable()
export class AppService {
  constructor(private events: EventEmitter2) {}
  create(body: any) {
    const order = { id: Date.now(), ...body };
    this.events.emit('order.created', order);
    return { status: 'created', order };
  }
}
