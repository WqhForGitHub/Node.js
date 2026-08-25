import { Module } from '@nestjs/common';
import { WechatAuthController } from './wechatAuth.controller';
import { WechatAuthService } from './wechatAuth.service';
@Module({ controllers: [WechatAuthController], providers: [WechatAuthService] })
export class WechatAuthModule {}
