import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
@Injectable()
export class AppService {
  private tasks: any[] = [];
  private id = 0;
  create(dto: CreateTaskDto) {
    const t = { id: ++this.id, ...dto };
    this.tasks.push(t);
    return t;
  }
  findAll() {
    return this.tasks;
  }
}
