import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FeatureFlagService } from './feature-flag.service';
@Module({
  controllers: [AppController],
  providers: [AppService, FeatureFlagService],
})
export class AppModule {}
