import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private readonly repo: Repository<Product>) {}
  create(dto: any) {
    return this.repo.save(this.repo.create(dto));
  }
  findAll() {
    return this.repo.find();
  }
  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException();
    return item;
  }
  async update(id: number, dto: any) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }
  async remove(id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
