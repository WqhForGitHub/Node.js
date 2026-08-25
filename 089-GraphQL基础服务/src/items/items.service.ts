import { Injectable } from '@nestjs/common';
import { Item } from './item.model';
@Injectable()
export class ItemsService {
  private items: Item[] = [];
  private id = 0;
  create(name: string, description?: string) {
    const item = { id: ++this.id, name, description } as Item;
    this.items.push(item);
    return item;
  }
  findAll() {
    return this.items;
  }
  findOne(id: number) {
    return this.items.find((i) => i.id === id);
  }
}
