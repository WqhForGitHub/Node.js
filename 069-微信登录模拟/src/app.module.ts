import { Module } from '@nestjs/common';
import { WechatAuthModule } from './wechatAuth.module';
@Module({ imports: [WechatAuthModule] })
export class AppModule {}
