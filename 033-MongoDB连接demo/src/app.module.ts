import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocModule } from './doc/doc.module';
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/demo'),
    DocModule,
  ],
})
export class AppModule {}
