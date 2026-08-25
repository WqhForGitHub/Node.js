import { Module } from '@nestjs/common';
import { SearchDocModule } from './searchDoc.module';
@Module({ imports: [SearchDocModule] })
export class AppModule {}
