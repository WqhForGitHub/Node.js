import { Module } from '@nestjs/common';
import { OpLogModule } from './opLog.module';
@Module({ imports: [OpLogModule] })
export class AppModule {}
