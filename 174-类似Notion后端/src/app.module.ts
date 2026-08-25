import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PageModule } from './page/page.module';
import { BlockModule } from './block/block.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PageModule, BlockModule, StatsModule] })
export class AppModule {}
