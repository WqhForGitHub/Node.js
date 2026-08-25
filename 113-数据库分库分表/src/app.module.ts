import { Module } from '@nestjs/common';
import { ShardModule } from './shard.module';
@Module({ imports: [ShardModule] })
export class AppModule {}
