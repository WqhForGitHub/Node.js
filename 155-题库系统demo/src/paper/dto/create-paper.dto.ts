import { IsString, IsOptional } from 'class-validator';
export class CreatePaperDto {
  @IsString() title: string;
  @IsString() @IsOptional() questionIds: string;
}
