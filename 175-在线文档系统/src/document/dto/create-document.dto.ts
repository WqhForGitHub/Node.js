import { IsString, IsOptional } from 'class-validator';
export class CreateDocumentDto {
  @IsString() title: string;
  @IsString() @IsOptional() owner: string;
  @IsString() @IsOptional() content: string;
}
