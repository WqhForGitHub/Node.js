import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { MathService } from './math.service';
@Controller()
export class MathController {
  constructor(private readonly math: MathService) {}
  @MessagePattern('math.add') add(@Payload() data: number[]) {
    return this.math.accumulate(data);
  }
  @EventPattern('math.log') log(@Payload() data: any) {
    console.log('Received:', data);
  }
}
