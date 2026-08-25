import { IsString, IsOptional } from 'class-validator';
export class CreatePositionDto {
  @IsString() title: string;
  @IsString() @IsOptional() department: string;
  @IsString() @IsOptional() headcount: string;
}
