import { Module } from '@nestjs/common';
import { CircuitModule } from './circuit.module';
@Module({ imports: [CircuitModule] })
export class AppModule {}
