import { Module } from '@nestjs/common';
import { OssObjectModule } from './ossObject.module';
@Module({ imports: [OssObjectModule] })
export class AppModule {}
