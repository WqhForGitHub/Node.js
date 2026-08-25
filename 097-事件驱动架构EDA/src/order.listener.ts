import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
@Injectable()
export class OrderListener {
  @OnEvent('order.created') handleOrderCreated(payload: any) {
    console.log('Order created event:', JSON.stringify(payload));
  }
}
