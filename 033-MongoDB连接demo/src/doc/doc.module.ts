import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Doc, DocSchema } from './doc.schema';
import { DocService } from './doc.service';
import { DocController } from './doc.controller';
@Module({
  imports: [MongooseModule.forFeature([{ name: Doc.name, schema: DocSchema }])],
  providers: [DocService],
  controllers: [DocController],
})
export class DocModule {}
