import { Order } from './order.aggregate';
export abstract class OrderRepository {
  abstract save(order: Order): void;
  abstract findById(id: number): Order | undefined;
}
