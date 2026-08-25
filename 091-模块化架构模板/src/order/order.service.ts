import { Injectable } from '@nestjs/common';
@Injectable()
export class OrderService {
  private orders = [{ id: 1, total: 99 }];
  findAll() {
    return this.orders;
  }
}
