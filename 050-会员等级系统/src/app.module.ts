import { Module } from '@nestjs/common';
import { MembershipModule } from './membership.module';
@Module({ imports: [MembershipModule] })
export class AppModule {}
