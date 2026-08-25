import { Injectable, NotFoundException } from '@nestjs/common';
@Injectable()
export class AppService {
  private users: any[] = [];
  private id = 0;
  hello() {
    return { message: 'Hello from REST demo' };
  }
  listUsers(page?: number) {
    const p = Number(page) || 1;
    return { page: p, total: this.users.length, data: this.users };
  }
  create(body: any) {
    const u = { id: ++this.id, ...body };
    this.users.push(u);
    return u;
  }
  replace(id: number, body: any) {
    const u = this.find(id);
    Object.assign(u, body, { id });
    return u;
  }
  patch(id: number, body: any) {
    const u = this.find(id);
    Object.assign(u, body);
    return u;
  }
  remove(id: number) {
    const i = this.users.findIndex((u) => u.id === id);
    if (i === -1) throw new NotFoundException();
    this.users.splice(i, 1);
    return { deleted: true };
  }
  private find(id: number) {
    const u = this.users.find((x) => x.id === id);
    if (!u) throw new NotFoundException();
    return u;
  }
}
