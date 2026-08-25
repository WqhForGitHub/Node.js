import { Injectable, NotFoundException } from '@nestjs/common';
@Injectable()
export class AppService {
  ok() {
    return 'ok';
  }
  item(id: number) {
    if (id > 100) throw new NotFoundException('Item ' + id + ' not found');
    return { id };
  }
}
