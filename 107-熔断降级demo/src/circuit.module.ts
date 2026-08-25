import { Module } from '@nestjs/common';
import { CircuitController } from './circuit.controller';
import { CircuitService } from './circuit.service';
@Module({ controllers: [CircuitController], providers: [CircuitService] })
export class CircuitModule {}
