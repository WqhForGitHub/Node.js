import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
@Injectable()
export class AppService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
  async compute(id: string) {
    const key = 'compute:' + id;
    const cached = await this.cache.get(key);
    if (cached) return { source: 'cache', data: cached };
    const value = Math.floor(Math.random() * 1000);
    await this.cache.set(key, value);
    return { source: 'computed', data: value };
  }
}
