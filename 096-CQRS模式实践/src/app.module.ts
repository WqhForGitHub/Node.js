import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppController } from './app.controller';
import { CreateItemHandler, GetItemsHandler } from './handlers';
import { ItemService } from './item.service';
@Module({
  imports: [CqrsModule],
  controllers: [AppController],
  providers: [ItemService, CreateItemHandler, GetItemsHandler],
})
export class AppModule {}
