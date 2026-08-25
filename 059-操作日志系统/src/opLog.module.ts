import { Module } from '@nestjs/common';
import { OpLogController } from './opLog.controller';
import { OpLogService } from './opLog.service';
@Module({ controllers: [OpLogController], providers: [OpLogService] })
export class OpLogModule {}
