import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
@Module({
  imports: [CacheModule.register({ isGlobal: true, ttl: 60 })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
