import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MathService } from './math.service';
@Controller()
export class MathController {
  constructor(private svc: MathService) {}
  @MessagePattern('math.add') add(@Payload() data: { a: number; b: number }) {
    return { result: this.svc.add(data.a, data.b) };
  }
}
