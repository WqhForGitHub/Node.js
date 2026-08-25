import { Module } from '@nestjs/common';
import { PoolModule } from './pool.module';
@Module({ imports: [PoolModule] })
export class AppModule {}
