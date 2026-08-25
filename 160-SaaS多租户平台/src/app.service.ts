import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private data: Record<string, any[]> = {};
  findAll(tenantId: string) {
    return this.data[tenantId] || [];
  }
  create(tenantId: string, body: any) {
    if (!this.data[tenantId]) this.data[tenantId] = [];
    const item = { id: this.data[tenantId].length + 1, ...body };
    this.data[tenantId].push(item);
    return item;
  }
}
