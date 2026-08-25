import { Module } from '@nestjs/common';
import { CloudFileController } from './cloudFile.controller';
import { CloudFileService } from './cloudFile.service';
@Module({ controllers: [CloudFileController], providers: [CloudFileService] })
export class CloudFileModule {}
