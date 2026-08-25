import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MessageModule } from './message/message.module';
import { ConversationModule } from './conversation/conversation.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, MessageModule, ConversationModule, StatsModule],
})
export class AppModule {}
