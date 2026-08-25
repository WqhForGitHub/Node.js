import { Module } from '@nestjs/common';
import { ShardController } from './shard.controller';
import { ShardService } from './shard.service';
@Module({ controllers: [ShardController], providers: [ShardService] })
export class ShardModule {}
