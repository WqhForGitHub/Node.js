import { Module } from '@nestjs/common';
import { SyncTaskController } from './syncTask.controller';
import { SyncTaskService } from './syncTask.service';
@Module({ controllers: [SyncTaskController], providers: [SyncTaskService] })
export class SyncTaskModule {}
