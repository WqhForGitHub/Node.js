import { Module } from '@nestjs/common';
import { IndexDocController } from './indexDoc.controller';
import { IndexDocService } from './indexDoc.service';
@Module({ controllers: [IndexDocController], providers: [IndexDocService] })
export class IndexDocModule {}
