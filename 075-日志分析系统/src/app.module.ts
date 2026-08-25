import { Module } from '@nestjs/common';
import { LogEntryModule } from './logEntry.module';
@Module({ imports: [LogEntryModule] })
export class AppModule {}
