import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Doc, DocDocument } from './doc.schema';
@Injectable()
export class DocService {
  constructor(@InjectModel(Doc.name) private model: Model<DocDocument>) {}
  create(dto: any) {
    return this.model.create(dto);
  }
  findAll() {
    return this.model.find().exec();
  }
  async findOne(id: string) {
    const item = await this.model.findById(id).exec();
    if (!item) throw new NotFoundException();
    return item;
  }
  update(id: string, dto: any) {
    return this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
  }
  async remove(id: string) {
    await this.model.findByIdAndDelete(id).exec();
    return { deleted: true };
  }
}
