import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
@Injectable()
export class AppService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
  async get(key: string) {
    const cached = await this.cache.get(key);
    if (cached) return { source: 'cache', value: cached };
    const value = Math.floor(Math.random() * 10000);
    await this.cache.set(key, value);
    return { source: 'computed', value };
  }
}
