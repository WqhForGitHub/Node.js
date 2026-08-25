import { Module } from '@nestjs/common';
import { IndexDocModule } from './indexDoc.module';
@Module({ imports: [IndexDocModule] })
export class AppModule {}
