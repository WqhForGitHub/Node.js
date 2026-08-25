import { Module } from '@nestjs/common';
import { OauthAccountModule } from './oauthAccount.module';
@Module({ imports: [OauthAccountModule] })
export class AppModule {}
