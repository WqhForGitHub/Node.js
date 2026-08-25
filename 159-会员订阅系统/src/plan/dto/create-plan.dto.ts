import { IsString, IsOptional } from 'class-validator';
export class CreatePlanDto {
  @IsString() name: string;
  @IsString() @IsOptional() price: string;
  @IsString() @IsOptional() duration: string;
}
