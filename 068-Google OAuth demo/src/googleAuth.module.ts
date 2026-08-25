import { Module } from '@nestjs/common';
import { GoogleAuthController } from './googleAuth.controller';
import { GoogleAuthService } from './googleAuth.service';
@Module({ controllers: [GoogleAuthController], providers: [GoogleAuthService] })
export class GoogleAuthModule {}
