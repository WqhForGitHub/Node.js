import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private http: HttpService) {}
  async aggregate() {
    const services = [
      process.env.USER_SVC || 'http://localhost:3001',
      process.env.ORDER_SVC || 'http://localhost:3002',
    ];
    const results = await Promise.all(
      services.map((url) =>
        firstValueFrom(this.http.get(url))
          .then((r) => r.data)
          .catch((e) => ({ error: e.message }))
      )
    );
    return { services: services, results };
  }
}
