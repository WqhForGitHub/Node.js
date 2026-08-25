import { Module } from '@nestjs/common';
import { OrderController } from './presentation/order.controller';
import { OrderApplicationService } from './application/order.service';
import { InMemoryOrderRepository } from './infrastructure/in-memory-order.repository';
import { OrderRepository } from './domain/order.repository';
@Module({
  controllers: [OrderController],
  providers: [
    OrderApplicationService,
    InMemoryOrderRepository,
    { provide: OrderRepository, useExisting: InMemoryOrderRepository },
  ],
})
export class AppModule {}
