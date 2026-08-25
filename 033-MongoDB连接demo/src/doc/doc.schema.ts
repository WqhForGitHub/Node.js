import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
@Schema({ timestamps: true })
export class Doc {
  @Prop() name: string;
  @Prop() description: string;
}
export type DocDocument = HydratedDocument<Doc>;
export const DocSchema = SchemaFactory.createForClass(Doc);
