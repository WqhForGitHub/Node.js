import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  info() {
    return { framework: 'Fastify + NestJS', time: Date.now() };
  }
}
