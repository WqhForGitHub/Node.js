import { ArgumentMetadata, Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
@Injectable()
export class ToIntPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata) {
    const n = parseInt(value, 10);
    if (isNaN(n)) throw new BadRequestException('Validation failed: ' + value + ' is not a number');
    return n;
  }
}
