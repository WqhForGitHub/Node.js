import { IsString, IsOptional } from 'class-validator';
export class CreateCouponDto {
  @IsString() code: string;
  @IsString() @IsOptional() discount: string;
  @IsString() @IsOptional() expireAt: string;
}
