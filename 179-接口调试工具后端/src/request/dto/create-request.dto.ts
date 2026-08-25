import { IsString, IsOptional } from 'class-validator';
export class CreateRequestDto {
  @IsString() method: string;
  @IsString() @IsOptional() url: string;
  @IsString() @IsOptional() body: string;
}
