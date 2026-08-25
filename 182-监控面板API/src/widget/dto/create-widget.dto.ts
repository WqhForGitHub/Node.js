import { IsString, IsOptional } from 'class-validator';
export class CreateWidgetDto {
  @IsString() dashboardId: string;
  @IsString() @IsOptional() type: string;
  @IsString() @IsOptional() config: string;
}
