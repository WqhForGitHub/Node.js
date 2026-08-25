import { Injectable } from '@nestjs/common';
import { Order, OrderItem } from '../domain/order.aggregate';
import { OrderRepository } from '../domain/order.repository';
@Injectable()
export class OrderApplicationService {
  constructor(private repo: OrderRepository) {}
  createOrder(customerId: number, items: OrderItem[]) {
    const order = new Order(Date.now(), customerId);
    items.forEach((i) => order.addItem(i));
    this.repo.save(order);
    return order.toSnapshot();
  }
  getOrder(id: number) {
    const o = this.repo.findById(id);
    return o ? o.toSnapshot() : null;
  }
}
