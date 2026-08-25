import { IsString, IsOptional } from 'class-validator';
export class CreatePurchaseDto {
  @IsString() userId: string;
  @IsString() @IsOptional() courseId: string;
  @IsString() @IsOptional() amount: string;
}
