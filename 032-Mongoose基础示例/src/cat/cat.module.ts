import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cat, CatSchema } from './cat.schema';
import { CatService } from './cat.service';
import { CatController } from './cat.controller';
@Module({
  imports: [MongooseModule.forFeature([{ name: Cat.name, schema: CatSchema }])],
  providers: [CatService],
  controllers: [CatController],
})
export class CatModule {}
