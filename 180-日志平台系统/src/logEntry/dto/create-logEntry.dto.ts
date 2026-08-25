import { IsString, IsOptional } from 'class-validator';
export class CreateLogEntryDto {
  @IsString() level: string;
  @IsString() @IsOptional() source: string;
  @IsString() @IsOptional() message: string;
}
