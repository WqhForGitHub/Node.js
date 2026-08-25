import { IsString, IsOptional } from 'class-validator';
export class CreateProjectDto {
  @IsString() name: string;
  @IsString() @IsOptional() owner: string;
  @IsString() @IsOptional() status: string;
}
