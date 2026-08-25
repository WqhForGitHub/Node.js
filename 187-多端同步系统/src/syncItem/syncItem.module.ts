import { Module } from '@nestjs/common';
import { SyncItemController } from './syncItem.controller';
import { SyncItemService } from './syncItem.service';
@Module({ controllers: [SyncItemController], providers: [SyncItemService] })
export class SyncItemModule {}
