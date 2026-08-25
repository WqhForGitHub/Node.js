import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
@Module({ imports: [UserModule, OrderModule] })
export class AppModule {}
