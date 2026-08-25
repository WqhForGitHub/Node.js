import { IsString, IsOptional } from 'class-validator';
export class CreateDashboardDto {
  @IsString() name: string;
  @IsString() @IsOptional() owner: string;
}
