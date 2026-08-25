import { Module } from '@nestjs/common';
import { EsDocModule } from './esDoc.module';
@Module({ imports: [EsDocModule] })
export class AppModule {}
