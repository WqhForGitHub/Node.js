import { Controller, Get } from '@nestjs/common';
import { OrderService } from './order.service';
@Controller('orders')
export class OrderController {
  constructor(private svc: OrderService) {}
  @Get() findAll() {
    return this.svc.findAll();
  }
}
