import { IsString, IsOptional } from 'class-validator';
export class CreateSourceDto {
  @IsString() name: string;
  @IsString() @IsOptional() type: string;
}
