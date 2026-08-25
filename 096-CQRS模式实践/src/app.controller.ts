import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateItemCommand, GetItemsQuery } from './commands';
@Controller('items')
export class AppController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}
  @Post() create(@Body() body: { name: string }) {
    return this.commandBus.execute(new CreateItemCommand(body.name));
  }
  @Get() findAll() {
    return this.queryBus.execute(new GetItemsQuery());
  }
}
