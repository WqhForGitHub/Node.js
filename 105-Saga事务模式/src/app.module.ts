import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SagaOrchestrator } from './saga.orchestrator';
@Module({ controllers: [AppController], providers: [SagaOrchestrator] })
export class AppModule {}
