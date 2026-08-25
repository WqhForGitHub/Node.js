import { Field, ObjectType, ID } from '@nestjs/graphql';
@ObjectType()
export class Item {
  @Field(() => ID) id: number;
  @Field() name: string;
  @Field({ nullable: true }) description?: string;
}
