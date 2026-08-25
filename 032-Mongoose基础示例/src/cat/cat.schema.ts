import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
@Schema({ timestamps: true })
export class Cat {
  @Prop() name: string;
  @Prop() description: string;
}
export type CatDocument = HydratedDocument<Cat>;
export const CatSchema = SchemaFactory.createForClass(Cat);
