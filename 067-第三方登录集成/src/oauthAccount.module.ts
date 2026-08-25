import { Module } from '@nestjs/common';
import { OauthAccountController } from './oauthAccount.controller';
import { OauthAccountService } from './oauthAccount.service';
@Module({
  controllers: [OauthAccountController],
  providers: [OauthAccountService],
})
export class OauthAccountModule {}
