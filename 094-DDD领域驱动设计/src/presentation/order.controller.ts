import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OrderApplicationService } from '../application/order.service';
@Controller('orders')
export class OrderController {
  constructor(private svc: OrderApplicationService) {}
  @Post() create(@Body() body: { customerId: number; items: any[] }) {
    return this.svc.createOrder(body.customerId, body.items);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getOrder(id);
  }
}
