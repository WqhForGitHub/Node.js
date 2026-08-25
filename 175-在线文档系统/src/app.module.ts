import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { SectionModule } from './section/section.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, DocumentModule, SectionModule, StatsModule] })
export class AppModule {}
