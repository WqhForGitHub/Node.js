import { IsString, IsOptional } from 'class-validator';
export class CreateAlertDto {
  @IsString() ruleId: string;
  @IsString() @IsOptional() level: string;
  @IsString() @IsOptional() message: string;
}
