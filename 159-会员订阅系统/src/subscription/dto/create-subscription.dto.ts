import { IsString, IsOptional } from 'class-validator';
export class CreateSubscriptionDto {
  @IsString() userId: string;
  @IsString() @IsOptional() planId: string;
  @IsString() @IsOptional() status: string;
}
