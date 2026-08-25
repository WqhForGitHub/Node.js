import { Module } from '@nestjs/common';
import { LogEntryController } from './logEntry.controller';
import { LogEntryService } from './logEntry.service';
@Module({ controllers: [LogEntryController], providers: [LogEntryService] })
export class LogEntryModule {}
