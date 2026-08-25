import { IsString, IsOptional } from 'class-validator';
export class CreateRuleDto {
  @IsString() name: string;
  @IsString() @IsOptional() condition: string;
  @IsString() @IsOptional() enabled: string;
}
