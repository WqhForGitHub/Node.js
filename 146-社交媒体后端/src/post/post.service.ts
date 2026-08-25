import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
@Injectable()
export class PostService {
  private items: any[] = [];
  private id = 0;
  create(dto: CreatePostDto) {
    const item = { id: ++this.id, ...dto, createdAt: new Date().toISOString() };
    this.items.push(item);
    return item;
  }
  findAll(query?: { keyword?: string }) {
    if (query && query.keyword) {
      return this.items.filter((i) => JSON.stringify(i).indexOf(query.keyword) !== -1);
    }
    return this.items;
  }
  findOne(id: number) {
    const item = this.items.find((i) => i.id === id);
    if (!item) throw new NotFoundException('Post ' + id + ' not found');
    return item;
  }
  update(id: number, dto: any) {
    const item = this.findOne(id);
    Object.assign(item, dto);
    return item;
  }
  remove(id: number) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) throw new NotFoundException('Post ' + id + ' not found');
    this.items.splice(idx, 1);
    return { deleted: true };
  }
}
