import { Module } from '@nestjs/common';
import { CloudFileModule } from './cloudFile.module';
@Module({ imports: [CloudFileModule] })
export class AppModule {}
