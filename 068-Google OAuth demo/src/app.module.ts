import { Module } from '@nestjs/common';
import { GoogleAuthModule } from './googleAuth.module';
@Module({ imports: [GoogleAuthModule] })
export class AppModule {}
