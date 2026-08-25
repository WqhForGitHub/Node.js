import { Module } from '@nestjs/common';
import { ReplicaModule } from './replica.module';
@Module({ imports: [ReplicaModule] })
export class AppModule {}
