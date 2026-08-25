import { IsString, IsOptional } from 'class-validator';
export class CreateSprintDto {
  @IsString() name: string;
  @IsString() @IsOptional() goal: string;
  @IsString() @IsOptional() active: string;
}
