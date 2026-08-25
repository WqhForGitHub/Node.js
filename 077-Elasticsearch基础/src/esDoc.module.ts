import { Module } from '@nestjs/common';
import { EsDocController } from './esDoc.controller';
import { EsDocService } from './esDoc.service';
@Module({ controllers: [EsDocController], providers: [EsDocService] })
export class EsDocModule {}
