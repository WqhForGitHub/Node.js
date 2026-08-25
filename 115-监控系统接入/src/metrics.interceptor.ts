import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private requests = 0;
  private totalMs = 0;
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    this.requests++;
    return next.handle().pipe(
      tap(() => {
        this.totalMs += Date.now() - start;
      })
    );
  }
}
