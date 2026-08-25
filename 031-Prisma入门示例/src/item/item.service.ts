import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
@Injectable()
export class ItemService {
  constructor(private prisma: PrismaService) {}
  create(data: any) {
    return this.prisma.item.create({ data }).catch(() => data);
  }
  findAll() {
    return this.prisma.item.findMany().catch(() => []);
  }
  findOne(id: number) {
    return this.prisma.item.findUnique({ where: { id } }).catch(() => null);
  }
}
