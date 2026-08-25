import { Injectable } from '@nestjs/common';
@Injectable()
export class ItemService {
  private items: any[] = [];
  private id = 0;
  add(name: string) {
    const item = { id: ++this.id, name };
    this.items.push(item);
    return item;
  }
  all() {
    return this.items;
  }
}
