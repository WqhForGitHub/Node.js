import { Module } from '@nestjs/common';
import { ConcurrentController } from './concurrent.controller';
import { ConcurrentService } from './concurrent.service';
@Module({ controllers: [ConcurrentController], providers: [ConcurrentService] })
export class ConcurrentModule {}
