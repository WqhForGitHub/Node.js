import { IsString, IsOptional } from 'class-validator';
export class CreateCollectionDto {
  @IsString() name: string;
  @IsString() @IsOptional() requestIds: string;
}
