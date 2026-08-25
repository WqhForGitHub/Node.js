import { Module } from '@nestjs/common';
import { ConcurrentModule } from './concurrent.module';
@Module({ imports: [ConcurrentModule] })
export class AppModule {}
