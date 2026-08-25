import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { CreateItemCommand, GetItemsQuery } from './commands';
import { ItemService } from './item.service';
@CommandHandler(CreateItemCommand)
export class CreateItemHandler implements ICommandHandler<CreateItemCommand> {
  constructor(private service: ItemService) {}
  async execute(cmd: CreateItemCommand) {
    return this.service.add(cmd.name);
  }
}
@QueryHandler(GetItemsQuery)
export class GetItemsHandler implements IQueryHandler<GetItemsQuery> {
  constructor(private service: ItemService) {}
  async execute(_q: GetItemsQuery) {
    return this.service.all();
  }
}
