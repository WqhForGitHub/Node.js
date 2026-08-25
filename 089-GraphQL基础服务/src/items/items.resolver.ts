import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Item } from './item.model';
import { ItemsService } from './items.service';
@Resolver(() => Item)
export class ItemsResolver {
  constructor(private items: ItemsService) {}
  @Query(() => [Item]) getItems() {
    return this.items.findAll();
  }
  @Query(() => Item, { nullable: true }) getItem(@Args('id') id: number) {
    return this.items.findOne(id);
  }
  @Mutation(() => Item) createItem(
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string
  ) {
    return this.items.create(name, description);
  }
}
