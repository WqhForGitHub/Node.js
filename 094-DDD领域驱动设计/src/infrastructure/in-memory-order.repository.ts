import { Injectable } from '@nestjs/common';
import { Order } from '../domain/order.aggregate';
import { OrderRepository } from '../domain/order.repository';
@Injectable()
export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<number, Order> = new Map();
  save(order: Order) {
    this.orders.set(order.id, order);
  }
  findById(id: number) {
    return this.orders.get(id);
  }
}
