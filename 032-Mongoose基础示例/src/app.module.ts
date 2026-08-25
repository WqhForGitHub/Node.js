import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatModule } from './cat/cat.module';
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/demo'),
    CatModule,
  ],
})
export class AppModule {}
