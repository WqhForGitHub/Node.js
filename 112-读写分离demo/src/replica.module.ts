import { Module } from '@nestjs/common';
import { ReplicaController } from './replica.controller';
import { ReplicaService } from './replica.service';
@Module({ controllers: [ReplicaController], providers: [ReplicaService] })
export class ReplicaModule {}
