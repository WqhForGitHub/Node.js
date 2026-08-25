import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppService } from './app.service';
import { AppController } from './app.controller';
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
