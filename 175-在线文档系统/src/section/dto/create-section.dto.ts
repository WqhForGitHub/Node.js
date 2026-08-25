import { IsString, IsOptional } from 'class-validator';
export class CreateSectionDto {
  @IsString() documentId: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() order: string;
}
