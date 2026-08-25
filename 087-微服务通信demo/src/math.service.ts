import { Injectable } from '@nestjs/common';
@Injectable()
export class MathService {
  accumulate(data: number[]) {
    return (data || []).reduce((a, b) => a + b, 0);
  }
}
