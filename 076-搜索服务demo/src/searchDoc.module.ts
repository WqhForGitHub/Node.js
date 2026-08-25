import { Module } from '@nestjs/common';
import { SearchDocController } from './searchDoc.controller';
import { SearchDocService } from './searchDoc.service';
@Module({ controllers: [SearchDocController], providers: [SearchDocService] })
export class SearchDocModule {}
