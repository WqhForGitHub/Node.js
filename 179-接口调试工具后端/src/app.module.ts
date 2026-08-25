import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RequestModule } from './request/request.module';
import { CollectionModule } from './collection/collection.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, RequestModule, CollectionModule, StatsModule] })
export class AppModule {}
