import { Module } from '@nestjs/common';
import { RecommendationModule } from './recommendation.module';
@Module({ imports: [RecommendationModule] })
export class AppModule {}
