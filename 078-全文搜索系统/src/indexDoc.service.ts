import { Injectable, NotFoundException } from '@nestjs/common';
@Injectable()
export class IndexDocService {
  private store: any[] = [];
  private id = 0;
  create(dto: any) {
    const item = { id: ++this.id, ...dto, createdAt: new Date().toISOString() };
    this.store.push(item);
    return item;
  }
  findAll() {
    return this.store;
  }
  findOne(id: number) {
    const item = this.store.find((i) => i.id === id);
    if (!item) throw new NotFoundException();
    return item;
  }
  update(id: number, dto: any) {
    const item = this.findOne(id);
    Object.assign(item, dto);
    return item;
  }
  remove(id: number) {
    const idx = this.store.findIndex((i) => i.id === id);
    if (idx === -1) throw new NotFoundException();
    this.store.splice(idx, 1);
    return { deleted: true };
  }
  action(name: string, payload: any) {
    return { action: name, payload, processedAt: new Date().toISOString() };
  }
}
