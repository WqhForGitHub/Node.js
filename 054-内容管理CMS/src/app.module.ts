import { Module } from '@nestjs/common';
import { PageModule } from './page.module';
@Module({ imports: [PageModule] })
export class AppModule {}
