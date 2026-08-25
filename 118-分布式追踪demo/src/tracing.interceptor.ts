import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const traceId = req.headers['x-trace-id'] || randomUUID();
    req.traceId = traceId;
    console.log('[trace] ' + traceId + ' ' + req.method + ' ' + req.url);
    return next.handle().pipe(tap(() => console.log('[trace] ' + traceId + ' done')));
  }
}
